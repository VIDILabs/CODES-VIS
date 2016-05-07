if(typeof(define) == "function") define(function(){return lineChart;})

function lineChart(arg){
    "use strict";
    var linechart = {},
        option = arg || {},
        width = option.width || 800,
        height = option.height || 300,
        padding = option.padding || {left: 70, right: 10, top: 25, bottom: 20},
        vmap = option.vmap || {},
        stats = option.stats || {},
        timestamps = option.timestamps,
        series = option.series,
        normalize = option.normalize || false,
        colors = option.colors || i2v.colors().set10c(),
        container = option.container || null,
        lineWidth = option.lineWidth || 1,
        minSelectWidth = option.minSelectWidth || 2 * width/timestamps.length,
        initDomain = option.initDomain || [timestamps[0], timestamps[Math.floor(0.25 * timestamps.length)]],
        // brush =  false,
        brush = option.brush || false,
        onchange = option.onchange || function(d) {},
        formatX = option.formatX || function(d){return d},
        formatY = option.formatY || function(d){return d};

    width -= padding.right+padding.left;

    var svg = i2v.Svg({
        width: width,
        height: height,
        padding: padding,
        container: container,
    });

    if(container) {
        container = (typeof(container) == "string") ? document.getElementById(container) : container;
        container.appendChild(svg);
    }

    var maxVals = [], minVals = [];

    Object.keys(series).forEach(function(s){
        var max = i2v.arrays.max(series[s]),
            min = i2v.arrays.min(series[s]);

        if(normalize){
            var slope = 1 / (max - min),
                c0 = - min / (max - min);
            series[s].forEach(function(t){
                t = t * slope + c0;
            });
            maxVals.push(max * slope + c0);
            minVals.push(min * slope + c0);
        } else {
            maxVals.push(max);
            minVals.push(min);
        }
    });

    var xDomain = [i2v.arrays.min(timestamps), i2v.arrays.max(timestamps)],
        yDomain = [i2v.arrays.min(minVals), i2v.arrays.max(maxVals)];

    var x = svg.axis({
        dim: "x",
        domain: xDomain,
        align: "bottom",
        ticks: 12,
        // tickInterval: 10000000,
        labelPos: {x: 0, y: -20},
        format: formatX
    });

    var y = svg.axis({
        dim: "y",
        domain: yDomain,
        align: "left",
        labelPos: {x: -20, y: -5},
        ticks: 7,
        format: formatY
    });

    svg.appendChild(x.axis());
    svg.appendChild(y.axis());

    var lines = svg.append("g"),
        legend = svg.append("g"),
        selector = svg.append('g');

    lines.translate(padding.left, padding.top);
    selector.translate(padding.left, padding.top);
    Object.keys(series).forEach(function(si,j){

        var path = i2v.svg.line({
            x: timestamps.map(function(t){return x(t); }),
            y: series[si].map(function(s){return y(s); })
        });

        lines.append("path")
           .attr("d", path())
           .css("fill", 'none')
           .css("stroke-width", lineWidth)
           .css("stroke", colors(si));
    })

    if(brush) {
        // i2v.Selector({
        //     container: svg,
        //     x: 0,
        //     y: 0,
        //     height: height,
        //     width: width,
        //     fixedHeight: height,
        //     offset: {x: padding.left, y: padding.top},
        //     // onmove: selectHighNodes,
        //     // onselect: function(){}
        // })

        var sx0 = x(initDomain[0]),
            sw0 = x(initDomain[1]);
        selector.base = selector.append("rect")
            .attr("x", sx0)
            .attr("y", 0)
            .attr("width", sw0)
            .attr("height", height)
            .css("fill", "green")
            .css("fill-opacity", 0.1)
            .css("cursor", "move");

        selector.padLeft = selector.append("rect")
            .attr("x", sx0)
            .attr("y", 0)
            .attr("width", 6)
            .attr("height", height)
            .css("fill", "#aaa")
            .css("fill-opacity", 0)
            .css("cursor", "ew-resize");

        selector.padRight = selector.append("rect")
            .attr("x", sw0 + 6)
            .attr("y", 0)
            .attr("width", 6)
            .attr("height", height)
            .css("fill", "#aaa")
            .css("fill-opacity", 0.0)
            .css("cursor", "ew-resize");

        selector.moveStart = false;
        selector.resizeLeft = false;
        selector.resizeRight = false;
        selector.base.onmousedown = function(evt){
            evt.preventDefault();
            selector.moveStart = true;
            selector.prevPos = evt.clientX;
        }

        selector.move = function(dist) {
            selector.base.attr('x', parseInt(selector.base.attr("x")) + dist);
            selector.padLeft.attr('x', parseInt(selector.padLeft.attr("x")) + dist);
            selector.padRight.attr('x', parseInt(selector.padRight.attr("x")) + dist);

        }

        selector.base.onmousemove = function(evt) {
            if(selector.moveStart) {
                var box = svg.getBoundingClientRect(),
                    rect = selector.base.getBoundingClientRect(),
                    offsetLeft = rect.left - box.left + 1,
                    offsetRight =  rect.right - box.left - 1;

                if(offsetLeft > padding.left && offsetRight < width+padding.left)
                    selector.move(evt.clientX-selector.prevPos);
                selector.prevPos = evt.clientX;
            }
        }

        svg.onmousemove = function(evt) {
            var offsetX = evt.clientX - svg.getBoundingClientRect().left;
            if(offsetX > width+padding.left || offsetX < padding.left) return;
            if(selector.resizeLeft) {
                var padRightX = parseInt(selector.padRight.attr("x")),
                    newWidth = Math.max(parseInt(selector.base.attr("width"))+ selector.prevPos-evt.clientX,minSelectWidth);
                if(newWidth>minSelectWidth){
                    selector.move(evt.clientX-selector.prevPos);
                    selector.base.attr('width', newWidth);
                    selector.padRight.attr('x', padRightX);
                }
            } else if(selector.resizeRight) {
                var newWidth = Math.max(parseInt(selector.base.attr("width")) + evt.clientX-selector.prevPos,minSelectWidth);
                if(newWidth>minSelectWidth) {
                    selector.base.attr('width', newWidth);
                    selector.padRight.attr('x', parseInt(selector.padRight.attr("x"))+evt.clientX-selector.prevPos)
                };
            } else if(selector.moveStart) {
                selector.move(evt.clientX-selector.prevPos);
            }
            selector.prevPos = evt.clientX;
        }

        selector.padLeft.onmousedown = function(evt) {
            selector.resizeLeft = true;
            selector.prevPos = evt.clientX;
        }

        selector.padRight.onmousedown = function(evt) {
            selector.resizeRight = true;
            selector.prevPos = evt.clientX;
        }

        svg.addEventListener("mouseup", function(evt) {
            if(selector.moveStart || selector.resizeLeft || selector.resizeRight) {
                selector.moveStart = false;
                selector.resizeLeft = false;
                selector.resizeRight = false;
                var rect = selector.base.getBoundingClientRect(),
                    x0 = rect.left - svg.getBoundingClientRect().left - padding.left,
                    x1 = rect.right - svg.getBoundingClientRect().left - padding.left;
                onchange([x.invert(x0), x.invert(x1)]);
            }
        }, false);
    }

    legend.append("g")
      .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 20)
        .attr("x", -50)
        .attr("dy", ".71em")
        .css("text-anchor", "end")
        .css("font-weight", "bold")
        .text("Normalized Mean");

    Object.keys(series).forEach(function(si,j){
        var legendPos = width,
            // legendWidth = legendPos / Object.keys(series).length;
            legendWidth = 120;
        legend.append("line")
            .attr("x1", legendPos-5-j*legendWidth)
            .attr("x2", legendPos-20-j*legendWidth)
            .attr("y1", 20)
            .attr("y2", 20)
            .css("stroke", colors(si))
            .css("stroke-width", 3);

        legend.append("text")
            .attr("x", legendPos-j*legendWidth)
            .attr("y", 25)
            .css("fill", "#222")
            .css("font-size", ".9em")
            .text(si);
    });
    return svg;
}
