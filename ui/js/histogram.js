if(typeof(define) == "function") define(function(){return histogram;});

function histogram(option){
    var option = option || {},
        data = option.data || {},
        width = option.width || 500,
        height = option.height || width,
        vmap = option.vmap || {},
        container = option.container || null,
        position = option.position || {x: 0, y:0},
        dataRange = option.dataRange || {min: 0, max: 1},
        color = option.color || "#179380",
        alpha = 1,
        margin = option.margin || {left: 70, right: 10, top: 10, bottom: 40},
        formatX = option.formatX || function(d) { return d; },
        formatY = option.formatY || function(d) { return d; },
        transform = option.transform;

    width -= margin.left + margin.right;
    height -= margin.top + margin.bottom;
    var svg = i2v.Svg({width: width, height: height, container: container, padding: margin});
    svg.style.position = 'relative';

    var histogram = svg.append("g"),
        bar = histogram.append("g"),
        rects = [],
        xAxis,
        yAxis,
        features = Object.keys(vmap).map(function(k){return vmap[k];}),
        stats;

    // for(var f in dataRange) {
    //     stats[f] = {min: dataRange[f].min, max: dataRange[f].max};
    //     stats[f].slope = 1 / (stats[f].max - stats[f].min);
    //     stats[f].const = -1 / (stats[f].max - stats[f].min);
    // }

    var getSize = function() { return height; },
        getAlpha = function() { return alpha; };

    function updateVMFunction(stats){
        if("size" in vmap) {
            getSize = i2v.Metric({
                domain: [0, stats[vmap.size].max],
                range: [0 , height]
            });
        }

        if("alpha" in vmap) {
            getAlpha =  function(d){
                return d * stats[vmap.color].slope + stats[vmap.color].const;
            };
        }
    }

    histogram.init = function() {

        data = transform(data, features);
        stats = p4.stats(data,features);

        updateVMFunction(stats);

        var len = data.length,
            barWidth =  width / len;

        var labelSize = (len > 30 ) ? '0.7em' : '0.9em';
        var labelAngle = (len > 50 ) ? -45 : 0;

        var x = svg.axis({
            dim: "x",
            scale: 'ordinal',
            domain: p4.arrays.seq(0, len-1),
            align: "bottom",
            labelSize: labelSize,
            labelAngle: labelAngle,
            // ticks: 8,
            // tickInterval: 10000000,
            labelPos: {x: 0, y: -20},
            format: formatX
        });

        var y = svg.axis({
            dim: "y",
            domain: [0, stats[vmap.size].max],
            align: "left",
            // scale: mmts.scale,
            labelPos: {x: -20, y: -5},
            ticks: 7,
            format: formatY
        });

        svg.appendChild(xAxis = x.show());
        svg.appendChild(yAxis = y.show());
        if(stats[vmap.size].max===0) return;
        for(var i = 0; i < len; i++) {
            var rect = bar.append("rect")
                .attr("x", (i + 0.1) * barWidth)
                .attr("y",  height - getSize(data[i][vmap.size]))
                .attr("width", barWidth*0.8)
                .attr("height", getSize(data[i][vmap.size]))
                .attr("fill", color);
            rects.push(rect);
        }



        bar.translate(margin.left, margin.top);
        return histogram;
    };

    histogram.update = function(data) {
        yAxis.remove();
        data = transform(data, features);
        stats = p4.stats(data,features);
        updateVMFunction(stats);

        var y = svg.axis({
            dim: "y",
            domain: [0, stats[vmap.size].max],
            align: "left",
            // scale: mmts.scale,
            labelPos: {x: -20, y: -5},
            ticks: 7,
            format: formatY
        });
        svg.appendChild(yAxis = y.show());
        for(var i = 0, len = data.length; i < len; i++) {
            rects[i].attr("y",  height - getSize(data[i][vmap.size]))
                .attr("height", getSize(data[i][vmap.size]))
                .attr("fill", color);
        }
    }

    return histogram.init();
};
