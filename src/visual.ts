/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import * as d3 from "d3";
type Selection<T extends d3.BaseType> = d3.Selection<T, any, any, any>;
import { VisualSettings } from "./settings";


export class Visual implements IVisual {

    private svg: Selection<SVGElement>;


    constructor(options: VisualConstructorOptions) {

        this.svg = d3.select(options.element)
            .append("svg")
            .classed("trunnel", true);

    }


    public update(options: VisualUpdateOptions) {


        // Set up the dimensions
        // var viewPortWidth = 1200
        // var viewPortHeight = 300
        var viewPortWidth = options.viewport.width;
        var viewPortHeight = options.viewport.height;
        // Size the svg to the viewport dimension
        this.svg.attr("width", viewPortWidth);
        this.svg.attr("height", viewPortHeight);




        var dataSource = [
            { name: "Withdrawn", value: 15 },
            { name: "Transfered", value: 10 },
            { name: "Certificate", value: 5 },
            { name: "Diploma", value: 5 },
            { name: "1st", value: 20 },
            { name: "2.1", value: 20 },
            { name: "2.2", value: 20 }
        ];



        var yAxisWidth = 50;
        var yLeavesAxisWidth = 50;
        var xAxisHeight = 25;
        // Calculate the chart size without axes
        var width = viewPortWidth - (yAxisWidth + yLeavesAxisWidth);
        var height = viewPortHeight - xAxisHeight;
        // Size of trunk height and width and leaves height as percentage of chart size
        var trunkHeightPercent = .4;
        var trunkWidthPercent = .8;
        var leavesHeightPercent = .8;
        // Branch spacing
        var branchSize = 1;
        // Calculate trunk height and width and leaves width
        var trunkHeight = height * trunkHeightPercent;
        var trunkWidth = width * trunkWidthPercent;
        var leaveWidth = width - trunkWidth;
        // Calculate the range for the leaves Y scale
        var leavesRangeStart = ((height / 2) * (1 - leavesHeightPercent));
        var leavesRangeEnd = height - leavesRangeStart;
        // Calculate the position of the top of the trunk
        var trunkTop = (height / 2) - (trunkHeight / 2);

        // Convert the incoming data into a new data set which adds
        // runSum, leafRunSum and end properties
        var data = [];
        // Leaves defines the number of records that are plotted as leaves. The last X records will in the source
        // will be treated as leaves.
        var leaves = 3;
        var items = dataSource.length;
        var branches = items - leaves;
        // Leaves domain is the total value of the leaves. TrunkDomain is the total value.
        var leavesDomain = 0;
        var trunkDomain = 0;
        // Branch and leaf category arrays will be used to populate the ordinal axis domains
        var branchCategoryValues = [];
        var leafCategoryValues = [];
        // A running sum of all values and leaves will be added to the data. And a flag indicating the row is a leaf value
        var runSum = 0;
        var leafRunSum = 0;
        var isLeaf = false;


        // Process the data array
        dataSource.forEach((item, index) => {

            trunkDomain += item.value;

            // If the row is a leaf
            if (index > (branches - 1)) {

                leavesDomain += (item.value);
                leafCategoryValues.push(item.name);
                isLeaf = true;

            }
            // If the row is branch
            else {

                branchCategoryValues.push(item.name);

            }


            data.push({ name: item.name, value: item.value, runSum: runSum, leafRunSum: leafRunSum, end: isLeaf });

            runSum += item.value;
            if (index > (branches - 1)) {
                leafRunSum += item.value;
            }


        })


        // Y scale maps the values to a portion of the trunk height
        var yScale = d3.scaleLinear()
            .domain([0, trunkDomain])
            .range([0, trunkHeight]);

        // Y scale leaves maps the leaf category values to a position on the leaves height
        var yScaleLeavesOrdinal = d3.scalePoint()
            .domain(leafCategoryValues)
            .range([leavesRangeStart, leavesRangeEnd]);


        // X scale maps the branch categories by position to a position on the trunk width

        var xScale = d3.scaleLinear()
            .domain([0, branches + 1])
            .range([trunkWidth / (branches + 1), trunkWidth]);

        // X scale ordinal maps the branch categories to a postion on the trunk width
        var xScaleOrdinal = d3.scalePoint()
            .domain(branchCategoryValues)
            .range([xScale(branchSize), xScale((branches - 1) + branchSize)]);

        // Colour scale maps each category to a colour within the specified range
        var colourScale = d3.scaleLinear<string, number>()
            .domain([0, items])
            .range(["Red", "Yellow"]);

        var yAxis = d3.axisLeft(yScale);

        var xAxisOrdinal = d3.axisTop(xScaleOrdinal);

        var yAxisLeavesOrdinal = d3.axisRight(yScaleLeavesOrdinal);


        //Return a horizontal line for a data point.
        //This is just there to stop the appearance of blending lines.
        //It is otherwise identical to the horizontal portion of getLine below.
        var getHorizontal = function (d, i) {

            var xScalePosition = i;
            if (d.end) { xScalePosition = branches; }

            var trunkPos = yScale(d.runSum + (d.value / 2)) + trunkTop;
            var moveToTop = "M 0, " + trunkPos + " ";
            var horizontalLine = "H " + xScale(xScalePosition) + " ";

            return moveToTop + horizontalLine;

        }


        // function to generate the path for each value
        var getLine =
            function (d, i) {

                // Get the mid point position on the yScale for this value.
                // Add in trunk top to position it below the start of the trunk top.
                var trunkPos = yScale(d.runSum + (d.value / 2)) + trunkTop;
                var moveToTop = "M 0, " + trunkPos + " ";

                // If the value is a branch
                if (!d.end) {

                    // Get the X position of the end of the line from the xScale and generate horizontal
                    var horizontalLine = "H " + xScale(i) + " ";
                    // Get the position of the control points from the xScale and generate a bezier
                    var control1 = xScale(i + branchSize) + "," + trunkPos + " ";
                    var control2 = xScale(i + branchSize) + "," + trunkPos + " ";
                    var endPoint = xScale(i + branchSize) + "," + 0 + " ";

                }

                // for outcome values
                else {

                    // Get the position of the end of the line from the xScale and generate horizontal
                    var horizontalLine = "H " + xScale(branches) + " ";
                    // Get the Y position of the leaf end point
                    var yPosition = yScaleLeavesOrdinal(d.name);
                    // Generate the bezier 
                    var control1 = (trunkWidth + (leaveWidth / 2)) + "," + trunkPos + " ";
                    var control2 = (trunkWidth + (leaveWidth / 2)) + "," + yPosition + " ";
                    var endPoint = (width) + "," + yPosition + " ";

                }

                return moveToTop + horizontalLine + "C " + control1 + control2 + endPoint;

            }

        // Select the chart object
        
        //var chart = d3.select(".chart");
        var chart = this.svg;
        chart.selectAll("g").remove();



        // Add a container to hold the chart and move it below and right of the axis
        var container = chart.append("g")
            .attr("transform", "translate(" + yAxisWidth + ", " + xAxisHeight + ")");


        // Add an element for each data point
        var line = container.selectAll("g")
            .data(data)
            .enter()
            .append("g");


        // Set the path options and add the whole line

        line.append("path")
            .attr("stroke", function (d, i) { return colourScale(i) })
            .attr("stroke-width", function (d) { return yScale(d.value) })
            .attr("fill", "none")
            .attr("shape-rendering", "geometricPrecision")
            .attr("d", getLine);

        // Set the path options and add the horizontal

        line.append("path")
            .attr("stroke", function (d, i) { return colourScale(i) })
            .attr("stroke-width", function (d) { return yScale(d.value) })
            .attr("fill", "none")
            .attr("shape-rendering", "crispEdges")
            .attr("d", getHorizontal);

        // Add axes and translate them into place

        chart.append("g")
            .call(yAxis)
            .attr("class", "axis")
            .attr("transform", "translate(" + (yAxisWidth - 10) + ", " + (xAxisHeight + trunkTop) + ")");

        chart.append("g")
            .call(xAxisOrdinal)
            .attr("class", "axis")
            .attr("transform", "translate(" + (yAxisWidth) + ", " + (xAxisHeight - 5) + ")");

        chart.append("g")
            .call(yAxisLeavesOrdinal)
            .attr("class", "axis")
            .attr("transform", "translate(" + (yAxisWidth + width + 5) + ", " + (xAxisHeight) + ")");


    }

}
