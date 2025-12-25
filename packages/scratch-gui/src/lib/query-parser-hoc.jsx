import React from 'react';
import PropTypes from 'prop-types';
import queryString from 'query-string';
import {connect} from 'react-redux';

import {activateDeck} from '../reducers/cards';
import {openTipsLibrary} from '../reducers/modals';
import {detectTutorialId} from './tutorial-from-url';

const getProjectUrlFromQuery = queryParams => {
    // Support both singular and common plural typo to be forgiving for users.
    const projectParam = queryParams.projectUrl ?? queryParams.projectsUrl;
    if (!projectParam) return null;
    const projectUrl = Array.isArray(projectParam) ? projectParam[0] : projectParam;
    try {
        return new URL(projectUrl, window.location.href).toString();
    } catch (e) {
        // fall back to the raw value if URL parsing fails; downstream loaders can handle errors
        return projectUrl;
    }
};

/* Higher Order Component to get parameters from the URL query string and initialize redux state
 * @param {React.Component} WrappedComponent: component to render
 * @returns {React.Component} component with query parsing behavior
 */
const QueryParserHOC = function (WrappedComponent) {
    class QueryParserComponent extends React.Component {
        constructor (props) {
            super(props);
            const queryParams = queryString.parse(location.search);
            const tutorialId = detectTutorialId(queryParams);
            this.externalProjectUrl = getProjectUrlFromQuery(queryParams);
            if (tutorialId) {
                if (tutorialId === 'all') {
                    this.openTutorials();
                } else {
                    this.setActiveCards(tutorialId);
                }
            }
        }
        setActiveCards (tutorialId) {
            this.props.onUpdateReduxDeck(tutorialId);
        }
        openTutorials () {
            this.props.onOpenTipsLibrary();
        }
        render () {
            const {
                onOpenTipsLibrary,
                onUpdateReduxDeck,
                ...componentProps
            } = this.props;
            return (
                <WrappedComponent
                    externalProjectUrl={this.externalProjectUrl}
                    {...componentProps}
                />
            );
        }
    }
    QueryParserComponent.propTypes = {
        onOpenTipsLibrary: PropTypes.func,
        onUpdateReduxDeck: PropTypes.func
    };
    const mapDispatchToProps = dispatch => ({
        onOpenTipsLibrary: () => {
            dispatch(openTipsLibrary());
        },
        onUpdateReduxDeck: tutorialId => {
            dispatch(activateDeck(tutorialId));
        }
    });
    return connect(
        null,
        mapDispatchToProps
    )(QueryParserComponent);
};

export {
    QueryParserHOC as default
};
