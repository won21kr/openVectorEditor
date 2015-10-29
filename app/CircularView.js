var StyleFeature = require('./StyleFeature');
var arcUtils = require('./graphic-helpers/arcUtils.js');
import assign from 'lodash/object/assign'
import React, { PropTypes } from 'react';
import { Decorator as Cerebral } from 'cerebral-react';
import { propTypes } from './react-props-decorators.js'; //tnrtodo: update this once the actual npm module updates its dependencies
var Draggable = require('react-draggable');

@Cerebral({
    rowViewDimensions: ['rowViewDimensions'],
    rowData: ['mapViewRowData'],
    charWidth: ['charWidth'],
    selectionLayer: ['selectionLayer'],
    cutsiteLabelSelectionLayer: ['cutsiteLabelSelectionLayer'],
    annotationHeight: ['annotationHeight'],
    tickSpacing: ['tickSpacing'],
    spaceBetweenAnnotations: ['spaceBetweenAnnotations'],
    showFeatures: ['showFeatures'],
    showTranslations: ['showTranslations'],
    showParts: ['showParts'],
    showOrfs: ['showOrfs'],
    showAxis: ['showAxis'],
    showSequence: ['showSequence'],
    showCutsites: ['showCutsites'],
    showReverseSequence: ['showReverseSequence'],
    caretPosition: ['caretPosition'],
    sequenceLength: ['sequenceLength'],
    bpsPerRow: ['bpsPerRow']
})
@propTypes({
    rowViewDimensions: PropTypes.object.isRequired,
    rowData: PropTypes.array.isRequired,
    charWidth: PropTypes.number.isRequired,
    selectionLayer: PropTypes.object.isRequired,
    cutsiteLabelSelectionLayer: PropTypes.object.isRequired,
    annotationHeight: PropTypes.number.isRequired,
    tickSpacing: PropTypes.number.isRequired,
    spaceBetweenAnnotations: PropTypes.number.isRequired,
    showFeatures: PropTypes.bool.isRequired,
    showTranslations: PropTypes.bool.isRequired,
    showParts: PropTypes.bool.isRequired,
    showOrfs: PropTypes.bool.isRequired,
    showAxis: PropTypes.bool.isRequired,
    showCutsites: PropTypes.bool.isRequired,
    showReverseSequence: PropTypes.bool.isRequired,
    caretPosition: PropTypes.number.isRequired,
    sequenceLength: PropTypes.number.isRequired,
    bpsPerRow: PropTypes.number.isRequired,
    handleEditorDrag: PropTypes.func.isRequired,
    handleEditorDragStart: PropTypes.func.isRequired,
    handleEditorDragStop: PropTypes.func.isRequired,
    handleEditorClick: PropTypes.func.isRequired,
})
class CircularView extends React.Component {
    getNearestCursorPositionToMouseEvent(event, callback) {
        var rowNotFound = true;
        var visibleRowsContainer = this.refs.InfiniteScroller.getVisibleRowsContainerDomNode();
        //loop through all the rendered rows to see if the click event lands in one of them
        for (var relativeRowNumber = 0; relativeRowNumber < visibleRowsContainer.childNodes.length; relativeRowNumber++) {
            var rowDomNode = visibleRowsContainer.childNodes[relativeRowNumber];
            var boundingRowRect = rowDomNode.getBoundingClientRect();
            // console.log('boundingRowRect.top', JSON.stringify(boundingRowRect.top,null,4));
            // console.log('boundingRowRect.height', JSON.stringify(boundingRowRect.height,null,4));
            if (event.clientY > boundingRowRect.top && event.clientY < boundingRowRect.top + boundingRowRect.height) {
                //then the click is falls within this row
                // console.log('HGGGG');
                rowNotFound = false;
                var rowNumber = this.refs.InfiniteScroller.state.visibleRows[relativeRowNumber];
                var row = this.props.rowData[rowNumber];
                if (event.clientX - boundingRowRect.left < 0) {
                    console.warn('this should never be 0...');
                    callback(row.start, event); //return the first bp in the row
                } else {
                    var clickXPositionRelativeToRowContainer = event.clientX - boundingRowRect.left;
                    var numberOfBPsInFromRowStart = Math.floor((clickXPositionRelativeToRowContainer + this.props.charWidth / 2) / this.props.charWidth);
                    var nearestBP = numberOfBPsInFromRowStart + row.start;
                    if (nearestBP > row.end + 1) {
                        nearestBP = row.end + 1;
                    }
                    // console.log('nearestBP', nearestBP);
                    callback(nearestBP, event);
                }
                break; //break the for loop early because we found the row the click event landed in
            }
        }
        if (rowNotFound) {
            console.warn('was not able to find the correct row');
            //return the last bp index in the rendered rows
            var lastOfRenderedRowsNumber = this.refs.InfiniteScroller.state.visibleRows[this.refs.InfiniteScroller.state.visibleRows.length - 1];
            var lastOfRenderedRows = this.props.rowData[lastOfRenderedRowsNumber];
            callback(lastOfRenderedRows.end, event);
        }
    }

    render() {
        var {showSequence, rowViewDimensions, rowData, handleEditorDrag, handleEditorDragStart, handleEditorDragStop, handleEditorClick, charWidth, selectionLayer, cutsiteLabelSelectionLayer, annotationHeight, tickSpacing, spaceBetweenAnnotations, showFeatures, showTranslations, showParts, showOrfs, showAxis, showCutsites, showReverseSequence, caretPosition, sequenceLength, bpsPerRow, signals} = this.props;


        var rowViewStyle = {
            height: rowViewDimensions.height,
            width: rowViewDimensions.width,
        //   overflowY: "scroll",
        // float: "left",
        // paddingRight: "20px"
        //   padding: 10
        };
        // console.log('rowData: ' + JSON.stringify(rowData,null,4));
        var annotationHeightRunningCount = 30;

        var center = {
            x: 250,
            y: 250
        }
        var radius = 100;
        var gapBetweenAnnotations = 5;
        var totalAnnotationHeight = annotationHeight + gapBetweenAnnotations;
        var startAngle = 0;
        var endAngle = 1;
        var direction = 1;

        function getAngleStartAndEndForRange(range, sequenceLength) {
            return {
                startAngle: 2 * Math.PI * (range.start / sequenceLength),
                endAngle: 2 * Math.PI * range.end / sequenceLength
            }
        }

        var annotationsSvgs = [];
        if (showSequence) {
            var path = arcUtils.drawPiePiece(center, annotationHeightRunningCount, annotationHeight, 0, 2*Math.PI - .00001, direction)
            annotationsSvgs.push(<path
                               d={ path }
                               onClick={function () {
                                   signals.selectAll();
                               }}
                               fill='black' />)
            annotationHeightRunningCount += totalAnnotationHeight
        }
        if (showFeatures) {
            var maxYOffset = 0;
            rowData[0].features.forEach(function(annotation) {
                var {startAngle, endAngle} = getAngleStartAndEndForRange(annotation, sequenceLength);
                if (annotation.yOffset > maxYOffset) maxYOffset = annotation.yOffset;
                var path = arcUtils.drawDirectedPiePiece(center, annotationHeightRunningCount + (annotationHeight + 5) * annotation.yOffset + 15, annotationHeight, startAngle, endAngle, direction)
                annotationsSvgs.push(
                    <StyleFeature
                        onClick={function (event) {
                            signals.setSelectionLayer({selectionLayer: this});
                            event.stopPropagation();
                        }.bind(annotation)}
                        color={annotation.color}>
                        <path
                                   d={ path }
                                   onClick={function () {
                                       signals.annotationClicked(annotation);
                                   }}
                                   fill={annotation.color} />
                    </StyleFeature>
                    )
            })
            annotationHeightRunningCount += maxYOffset + 1 * totalAnnotationHeight
        }
        if (showParts) {
            rowData[0].parts.forEach(function(feature) {
                var {startAngle, endAngle} = getAngleStartAndEndForRange(feature, sequenceLength)
                var path = arcUtils.drawDirectedPiePiece(center, annotationHeightRunningCount + (annotationHeight + 5) * feature.yOffset + 15, annotationHeight, startAngle, endAngle, direction)
                annotationsSvgs.push(<path
                                   d={ path }
                                   fill="orange" />)
            })
            annotationHeightRunningCount += rowData[0].parts.length * annotationHeight
        }
        if (showTranslations) {
            rowData[0].translations.forEach(function(feature) {
                var {startAngle, endAngle} = getAngleStartAndEndForRange(feature, sequenceLength)
                var path = arcUtils.drawDirectedPiePiece(center, annotationHeightRunningCount + (annotationHeight + 5) * feature.yOffset + 15, annotationHeight, startAngle, endAngle, direction)
                annotationsSvgs.push(<path
                                   d={ path }
                                   fill="orange" />)
            })
            annotationHeightRunningCount += rowData[0].translations.length * annotationHeight
        }

        if (showReverseSequence) {
            rowData[0].features.forEach(function(feature) {
                var path = arcUtils.drawDirectedPiePiece(center, annotationHeightRunningCount + (annotationHeight + 5) * feature.yOffset + 15, annotationHeight, startAngle, endAngle, direction)
                annotationsSvgs.push(<path
                                   d={ path }
                                   fill="green" />)
            })
            annotationHeightRunningCount += rowData[0].features.length * annotationHeight
        }

        if (selectionLayer.selected) {
            var {startAngle, endAngle} = getAngleStartAndEndForRange(selectionLayer, sequenceLength)
            var path = arcUtils.drawPiePiece(center, 150, annotationHeightRunningCount, startAngle, endAngle, direction)
            annotationsSvgs.push(<path
                               style={ {    opacity: .4} }
                               d={ path }
                               fill="blue" />)
        }
        var circViewStyle = assign({}, rowViewDimensions, {
            height: rowViewDimensions.height + 200
        // overflowY: 'none'
        })
        return (
            <div style={ circViewStyle }>
              <svg
                width={ annotationHeightRunningCount + 500 }
                height={ annotationHeightRunningCount + 500 }>
                <g transform={ "translate(" + annotationHeightRunningCount / 2 + "," + annotationHeightRunningCount / 2 + ")" }>
                  { annotationsSvgs }
                </g>
              </svg>
            </div>
            );
    }
}

module.exports = CircularView;