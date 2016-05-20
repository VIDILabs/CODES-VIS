if(typeof(define) == "function") define(function(){return ringChart;})

function ringChart(option){
    var option = option || {},
        data = option.data || {},
        width = option.width || 500,
        height = option.height || width,
        vmap = option.vmap || {},
        container = option.container || null,
        innerRadius = option.innerRadius || width/2 * 0.8,
        outerRadius = option.outerRadius || width/2,
        dataRange = option.dataRange || {min: 0, max: 1},
        color = option.color || 120,
        circle = option.circle || false;

    var ring = container.append("g");
    var elements = [], vi;



    var stats = {},
        features = Object.keys(vmap).map(function(k){return vmap[k];});

    // for(var f in dataRange) {
    //     stats[f] = {min: dataRange[f].min, max: dataRange[f].max};
    //     if(stats[f].max == stats[f].min) stats[f].max += 0.0001;
    //     stats[f].slope = 1 / (stats[f].max - stats[f].min);
    //     stats[f].const = -1 / (stats[f].max - stats[f].min);
    // }

    stats = p4.stats(data, features);
    features.forEach(function(f){
        if(stats[f].max == stats[f].min) stats[f].max += 0.0001;
        stats[f].slope = 1 / (stats[f].max - stats[f].min);
        stats[f].const = -1 / (stats[f].max - stats[f].min);
    });
    // console.log(vmap, stats);
    function coord(r, rad){
        var x = width/2 + r * Math.cos(rad),
            y = height/2 + r * Math.sin(rad);
        return {x: x, y: y};
    }

    data.forEach(function(d){
        if(d < stats[vmap.color].min) console.log(d);
    })

    var getSize = function() { return (outerRadius - innerRadius); },
        getColor = function() { return color; },
        getIntensity = function() {return 1.0};

    if("size" in vmap) {
        getSize = i2v.Metric({domain: [stats[vmap.size].min, stats[vmap.size].max], range: [0 , outerRadius-innerRadius]});
    }

    if("color" in vmap) {
        getColor =  function(value){
            var max = d3.max(data.map(function(d){return d[vmap.color];})),
                min = d3.min(data.map(function(d){return d[vmap.color];}))
            if(value > max ) value = max;
            var colorScale = d3.scale.linear().domain([min, max]).range([120,0]);
            return 'hsl('+colorScale(value)+', 100%, 40%)';
        };
    }

    ring.init = function() {
        var start = 0,
            end =  2 * Math.PI,
            n = data.length,
            interval = (end - start) / n;


        for(var i = 0; i<n; i++) {
            if(circle){
                var cirSize = 0.5 * (outerRadius - innerRadius),
                    pos = coord(innerRadius + cirSize, start + 0.5*interval);

                vi = ring.append("circle")
                    .attr('cx', pos.x)
                    .attr('cy', pos.y)
                    .attr('r', Math.max(1, 0.5*getSize(data[i][vmap.size])))
                    .attr("fill", getColor(data[i][vmap.color]));


            } else {
                var size  = getSize(data[i][vmap.size]);

                if(size>0){
                    var arc = i2v.SvgArc({
                        outerRadius: innerRadius + size,
                        innerRadius: innerRadius,
                        width: width,
                        height: height,
                        radianStart: start,
                        radianEnd: start + interval,
                    });

                    vi = ring.append("path")
                        .attr("class", "arc")
                        .attr("d", arc)
                        .attr("stroke-width", 0)
                        .attr("fill", getColor(data[i][vmap.color]));
                }

            }
            elements.push(vi);
            start += interval;
        }
        // ring.items = items;
        ring.vi = elements;

        return ring;
    };

    ring.update = function(data) {
        var start = 0,
            end =  2 * Math.PI,
            n = data.length,
            interval = (end - start) / n;
        elements.forEach(function(d, i) {
            if(circle){
                d.attr('r', Math.max(1, 0.5*getSize(data[i][vmap.size])))
                    .attr("fill", getColor(data[i][vmap.color]));
            } else {
                var size  = getSize(data[i][vmap.size]);
                var arc = i2v.SvgArc({
                    outerRadius: innerRadius + size,
                    innerRadius: innerRadius,
                    width: width,
                    height: height,
                    radianStart: start,
                    radianEnd: start + interval,
                });

                d.attr("d", arc).attr("fill", getColor(data[i][vmap.color]));
            }

            start += interval;
        });

        return ring;
    };

    return ring.init();
};
