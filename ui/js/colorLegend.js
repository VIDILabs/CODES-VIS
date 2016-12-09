define(['i2v/metric', 'i2v/svg', 'i2v/format', 'i2v/svg/axis'], function(Metric, Svg, printformat, Axis){
    'use strict';
    var gradID = 0;
    return function colorLegend(arg){
        var mmts = {},
            option = arg || {},
            width = option.width || 200,
            height = 40,
            padding = option.padding || {left: 40, right: 20, top: 0, bottom: 25},
            vmap = option.vmap || {},
            stats = option.stats || {},
            alpha = option.alpha || 0.2,
            colors = option.colors || ['#0E0', 'yellow', 'red'],
            container = option.container || null,
            domain = option.domain || ['min', 'max'],
            format = option.format || printformat(".2s");

        var gradientID = gradID++;

        width -= padding.left + padding.right;
        height -= padding.top + padding.bottom;

        var legend = Svg({width: width, height: height, padding: padding}),
            rect = legend.append("g");

        function linearGradient(colors) {
            var gradient = legend.append("defs")
                .append("linearGradient")
                    .attr("id", "gradlegend"+gradientID)
                    .attr("x1", "0%")
                    .attr("x2", "100%")
                    .attr("y1", "0%")
                    .attr("y2", "0%");

            colors.forEach(function(c, i){
                gradient.append("stop")
                    .attr("offset", i / (colors.length-1) )
                    .attr("stop-color", c);
            });
            return gradient;

        }

        var grad = linearGradient(colors);

        var rect = legend.append("g");

        var colorScale = rect.append("rect")
            .attr("x", padding.left)
            .attr("y", 0)
            .attr("width", width-padding.left)
            .attr("height", height)
            .css("fill","url(#gradlegend" + gradientID + ")");

        // legend.append("text")
        //     .attr("x", 0)
        //     .attr("y", height/2 + 5)
        //     .css("fill", "#222")
        //     .css("font-size", ".9em")
        //     .text(p4.io.printformat(".2s")(domain[0]));
        //
        // legend.append("text")
        //     .attr("x", width + padding.left + 5)
        //     .attr("y", height/2 + 5)
        //     .css("fill", "#222")
        //     .css("font-size", ".9em")
        //     .text(p4.io.printformat(".2s")(domain[1]));

        var xAxis = new Axis({
            dim: "x",
            domain: domain,
            container: legend,
            align: "bottom",
            ticks: 3,
            tickInterval: "fit",
            // height: height,
            // padding: padding,
            width: width-padding.left,
            // tickInterval: 10000000,
            labelPos: {x: 0, y: -20},
            format: format,
        }).show();

        legend.appendChild(xAxis);

        if(option.title) {
            legend.append("g")
              .append("text")
                .attr("y", padding.top/2)
                .attr("x", padding.left)
                .attr("dy", "1em")
                .css("text-anchor", "middle")
                .css("font-size", "0.9em")
                .text(option.title);
        }

        rect.translate(padding.left, padding.top);

        legend.update = function(newDomain, newColors) {

            legend.removeChild(xAxis);
            xAxis = new Axis({
                dim: "x",
                domain: newDomain,
                container: legend,
                align: "bottom",
                ticks: 4,
                // tickInterval: 10000000,
                labelPos: {x: 0, y: -20},
                width: width-padding.left,
                format: format,
            }).show();

            if(typeof(newColors) != "undefined") {
                grad.remove();
                grad = linearGradient(newColors);
                colorScale.css("fill","url(#gradlegend" + gradientID + ")");

            }
            // legend.appendChild(xAxis);

            return legend;
        }

        return legend;
    }
});
