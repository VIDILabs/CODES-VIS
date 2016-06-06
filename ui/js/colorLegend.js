if(typeof(define) == "function") define(function(){return colorLegend;})

function colorLegend(arg){
    // "use strict";
    var mmts = {},
        option = arg || {},
        width = option.width || 200,
        height = option.height || 30,
        padding = option.padding || {left: 50, right: 50, top: 0, bottom: 0},
        vmap = option.vmap || {},
        stats = option.stats || {},
        alpha = option.alpha || 0.2,
        colors = option.colors || ['#0E0', 'yellow', 'red'],
        container = option.container || null,
        domain = option.domain || ['min', 'max'],
        formatX = option.formatX || function(d) { return d; },
        formatY = option.formatY || function(d) { return d; };

    var legend = i2v.Svg({width: width, height: height}),
        rect = legend.append("g");

    width -= padding.left + padding.right;
    height -= padding.top + padding.bottom;

    var grad = legend.append("defs")
        .append("linearGradient")
            .attr("id", "gradlegend")
            .attr("x1", "0%")
            .attr("x2", "100%")
            .attr("y1", "0%")
            .attr("y2", "0%");

    colors.forEach(function(c, i){
        grad.append("stop")
            .attr("offset", i / (colors.length-1) )
            .attr("stop-color", c);
    });

    var rect = legend.append("g");
    rect.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", height)
        .css("fill","url(#gradlegend)");

    rect.translate(padding.left, padding.top);

    legend.append("text")
        .attr("x", 0)
        .attr("y", height/2)
        .css("fill", "#222")
        .css("font-size", ".9em")
        .text(p4.io.printformat(".2s")(domain[0]));

    legend.append("text")
        .attr("x", width + padding.left + 5)
        .attr("y", height/2)
        .css("fill", "#222")
        .css("font-size", ".9em")
        .text(p4.io.printformat(".2s")(domain[1]));

    return legend;
}
