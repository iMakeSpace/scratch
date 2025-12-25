import React from 'react';
import PropTypes from 'prop-types';
import {injectIntl} from 'react-intl';
import intlShape from './intlShape';
import bindAll from 'lodash.bindall';
import {connect} from 'react-redux';

import {setProjectUnchanged} from '../reducers/project-changed';
import {
    LoadingState,
    LoadingStates,
    getIsCreatingNew,
    getIsFetchingWithId,
    getIsLoading,
    getIsShowingProject,
    onFetchedProjectData,
    onLoadedProject,
    projectError,
    requestProjectUpload,
    setProjectId
} from '../reducers/project-state';
import {
    activateTab,
    BLOCKS_TAB_INDEX
} from '../reducers/editor-tab';

import log from './log';
import {GUIStoragePropType} from '../gui-config';
import {closeLoadingProject, openLoadingProject} from '../reducers/modals';

/* Higher Order Component to provide behavior for loading projects by id. If
 * there's no id, the default project is loaded.
 * @param {React.Component} WrappedComponent component to receive projectData prop
 * @returns {React.Component} component with project loading behavior
 */
const ProjectFetcherHOC = function (WrappedComponent) {
    class ProjectFetcherComponent extends React.Component {
        constructor (props) {
            super(props);
            bindAll(this, [
                'fetchProject',
                'loadExternalProject'
            ]);

            const storage = this.props.storage;

            storage.setProjectHost?.(props.projectHost);
            storage.setProjectToken?.(props.projectToken);
            storage.setAssetHost?.(props.assetHost);
            storage.setTranslatorFunction?.(props.intl.formatMessage);

            // props.projectId might be unset, in which case we use our default;
            // or it may be set by an even higher HOC, and passed to us.
            // Either way, we now know what the initial projectId should be, so
            // set it in the redux store.
            if (
                !props.externalProjectUrl &&
                props.projectId !== '' &&
                props.projectId !== null &&
                typeof props.projectId !== 'undefined'
            ) {
                this.props.setProjectId(props.projectId.toString());
            }
        }
        componentDidMount () {
            if (this.props.externalProjectUrl) {
                this.loadExternalProject(this.props.externalProjectUrl);
            }
        }
        componentDidUpdate (prevProps) {
            const storage = this.props.storage;

            if (prevProps.projectHost !== this.props.projectHost) {
                storage.setProjectHost?.(this.props.projectHost);
            }
            if (prevProps.projectToken !== this.props.projectToken) {
                storage.setProjectToken?.(this.props.projectToken);
            }
            if (prevProps.assetHost !== this.props.assetHost) {
                storage.setAssetHost?.(this.props.assetHost);
            }
            if (this.props.isFetchingWithId && !prevProps.isFetchingWithId) {
                this.fetchProject(this.props.reduxProjectId, this.props.loadingState);
            }
            if (this.props.isShowingProject && !prevProps.isShowingProject) {
                this.props.onProjectUnchanged();
            }
            if (this.props.isShowingProject && (prevProps.isLoadingProject || prevProps.isCreatingNew)) {
                this.props.onActivateTab(BLOCKS_TAB_INDEX);
            }
            if (this.props.externalProjectUrl && this.props.externalProjectUrl !== prevProps.externalProjectUrl) {
                this.loadExternalProject(this.props.externalProjectUrl);
            }
        }
        fetchProject (projectId, loadingState) {
            const storage = this.props.storage.scratchStorage;

            return storage
                .load(storage.AssetType.Project, projectId, storage.DataFormat.JSON)
                .then(projectAsset => {
                    if (projectAsset) {
                        this.props.onFetchedProjectData(projectAsset.data, loadingState);
                    } else {
                        // Treat failure to load as an error
                        // Throw to be caught by catch later on
                        throw new Error('Could not find project');
                    }
                })
                .catch(err => {
                    this.props.onError(err);
                    log.error(err);
                });
        }
        loadExternalProject (projectUrl) {
            this.props.onExternalLoadingStarted();
            return fetch(projectUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch project from ${projectUrl}: ${response.status}`);
                    }
                    return response.arrayBuffer();
                })
                .then(buffer => this.props.vm.loadProject(buffer))
                .then(() => this.props.onExternalLoadingFinished(true))
                .catch(error => {
                    this.props.onExternalLoadingFinished(false);
                    this.props.onError(error);
                    // 提示用户加载失败的原因，避免界面“无反应”的体验。
                    alert(`加载项目失败：${error.message || error}`); // eslint-disable-line no-alert
                    log.error(error);
                });
        }
        render () {
            const {
                
                assetHost,
                externalProjectUrl,
                intl,
                isLoadingProject: isLoadingProjectProp,
                loadingState,
                onActivateTab,
                onError: onErrorProp,
                onFetchedProjectData: onFetchedProjectDataProp,
                onProjectUnchanged,
                projectHost,
                projectId,
                projectToken,
                reduxProjectId,
                setProjectId: setProjectIdProp,
                 
                isFetchingWithId: isFetchingWithIdProp,
                ...componentProps
            } = this.props;
            return (
                <WrappedComponent
                    fetchingProject={isFetchingWithIdProp}
                    {...componentProps}
                />
            );
        }
    }
    ProjectFetcherComponent.propTypes = {
        storage: GUIStoragePropType,
        assetHost: PropTypes.string,
        canSave: PropTypes.bool,
        externalProjectUrl: PropTypes.string,
        intl: intlShape.isRequired,
        isCreatingNew: PropTypes.bool,
        isFetchingWithId: PropTypes.bool,
        isLoadingProject: PropTypes.bool,
        isShowingProject: PropTypes.bool,
        loadingState: PropTypes.oneOf(LoadingStates),
        onActivateTab: PropTypes.func,
        onError: PropTypes.func,
        onFetchedProjectData: PropTypes.func,
        onExternalLoadingFinished: PropTypes.func,
        onExternalLoadingStarted: PropTypes.func,
        onProjectUnchanged: PropTypes.func,
        projectHost: PropTypes.string,
        projectToken: PropTypes.string,
        projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        reduxProjectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        setProjectId: PropTypes.func,
        vm: PropTypes.object
    };
    ProjectFetcherComponent.defaultProps = {
        assetHost: 'https://assets.scratch.mit.edu',
        projectHost: 'https://projects.scratch.mit.edu'
    };

    const mapStateToProps = state => ({
        storage: state.scratchGui.config.storage,
        isCreatingNew: getIsCreatingNew(state.scratchGui.projectState.loadingState),
        isFetchingWithId: getIsFetchingWithId(state.scratchGui.projectState.loadingState),
        isLoadingProject: getIsLoading(state.scratchGui.projectState.loadingState),
        isShowingProject: getIsShowingProject(state.scratchGui.projectState.loadingState),
        loadingState: state.scratchGui.projectState.loadingState,
        reduxProjectId: state.scratchGui.projectState.projectId,
        vm: state.scratchGui.vm
    });
    const mapDispatchToProps = dispatch => ({
        onActivateTab: tab => dispatch(activateTab(tab)),
        onError: error => dispatch(projectError(error)),
        onFetchedProjectData: (projectData, loadingState) =>
            dispatch(onFetchedProjectData(projectData, loadingState)),
        setProjectId: projectId => dispatch(setProjectId(projectId)),
        onProjectUnchanged: () => dispatch(setProjectUnchanged()),
        onExternalLoadingStarted: () => {
            dispatch(openLoadingProject());
            dispatch(requestProjectUpload(LoadingState.NOT_LOADED));
        },
        onExternalLoadingFinished: success => {
            dispatch(onLoadedProject(LoadingState.LOADING_VM_FILE_UPLOAD, false, success));
            dispatch(closeLoadingProject());
        }
    });
    // Allow incoming props to override redux-provided props. Used to mock in tests.
    const mergeProps = (stateProps, dispatchProps, ownProps) => Object.assign(
        {}, stateProps, dispatchProps, ownProps
    );
    return injectIntl(connect(
        mapStateToProps,
        mapDispatchToProps,
        mergeProps
    )(ProjectFetcherComponent));
};

export {
    ProjectFetcherHOC as default
};
