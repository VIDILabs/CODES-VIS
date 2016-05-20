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
        color = option.color || 120,
        circle = option.circle || false,
        margin = option.margin || {left: 30, right: 30, top: 30, bottom: 20};

    width -= margin.left + margin.right;
    height -= margin.top + margin.bottom;
    var barWidth =  width /data.length;
    var histogram = container.append("g"),
        bar = histogram.append("g"),
        stats = {},
        features = Object.keys(vmap).map(function(k){return vmap[k];});
        stats = p4.stats(data,features);

    bar.translate(margin.left, margin.top);

    for(var f in dataRange) {
        stats[f] = {min: dataRange[f].min, max: dataRange[f].max};

        stats[f].slope = 1 / (stats[f].max - stats[f].min);
        stats[f].const = -1 / (stats[f].max - stats[f].min);
    }

    var getSize = function() { return height; },
        getColor = function() { return color; };

    if("size" in vmap) {
        getSize = i2v.Metric({
            domain: [stats[vmap.size].min, stats[vmap.size].max],
            range: [0 , height]
        });
    }

    if("color" in vmap) {
        getColor =  function(d){
            var value = color - (d * stats[vmap.color].slope + stats[vmap.color].const) * 120;
            if(value < 0) value = -value;
            if(value - color > 120) value = color;
            return  "hsl("+(Math.floor(value))+", 100%, 50%)";
        };
    }

    console.log(data);

    data.forEach(function(d){
        if(option.granu == "router")
            d.group_id = Math.floor(d.rank / 10);
        else if(option.granu == "node")
            d.group_id = Math.floor(d.rank / 51);
    });

    var sorted = data.map(function(d){return d[vmap.color];}).sort(function(a, b){return b - a;});

    var nodes = [];
    var query = {$by: "group_id"};
        query[vmap.color] = "$addToArray";
    var groupSorted = new p4.pipeline(data).group(query);


    groupSorted.result().map(function(d){
        nodes = nodes.concat( d[vmap.color].sort(function(a,b) { return b-a;} ));
    });

    console.log(groupSorted.result());

    // console.log(data);

    histogram.init = function() {
        var len = data.length;
        console.log(len, barWidth, position.y);

        for(var i = 0; i < len; i++) {

            if(len < 52) {
                var rect = bar.append("rect")
                    .attr("x", i * barWidth)
                    .attr("y",  position.y)
                    .attr("width", barWidth)
                    .attr("height", height)
                    .css("fill", getColor(data[i][vmap.color]));
            } else {
                var rect = bar.append("rect")
                    .attr("x", i * barWidth)
                    .attr("y",  position.y)
                    .attr("width", barWidth)
                    .attr("height", height)
                    .attr("fill", getColor(nodes[i]));
            }

                // .attr("stroke-width", 0.5)
                // .attr("stroke", "#777")
                // .attr("fill", getColor(nodes[i]));
                // .css("fill", getColor(sorted[i]));
                // .css("fill", getColor(data[i][vmap.color]));

            rect.onmouseover = function(evt) {
                this.attr("stroke", "#000")
                    .attr("stroke-width", 0.5);
            }

            rect.onmouseout = function(evt) {
                this.css("stroke-width", 0);
            }

        }

        bar.append("text")
            .attr("y", position.y+height+20)
            .attr("x", width)
            .attr("dy", ".91em")
            .css("font-size", "20px")
            .css("text-anchor", "end")
            .text("max: " + p4.io.printformat(".2s")(stats[vmap.color].max));


        bar.append("text")
            .attr("y", position.y+height+20)
            .attr("x", width-150)
            .attr("dy", ".91em")
            .css("font-size", "20px")
            .css("text-anchor", "end")
            .text("min: " + p4.io.printformat(".2s")(stats[vmap.color].min));

        bar.append("text")
            .attr("y", position.y+height+20)
            .attr("x", 0)
            .attr("dy", ".91em")
            .css("font-size", "20px")
            .css("text-anchor", "center")
            .text( option.granu + " : " + entity + " : " + vmap.color);

        // var grad = histogram.append("defs")
        //     .append("linearGradient")
        //     .attr("id", "gradryg")
        //     .attr("x1", "0%")
        //     .attr("x2", "100%")
        //     .attr("y1", "0%")
        //     .attr("y2", "0%");
        // //
        // grad.append("stop")
        //     .attr("offset", "0%" )
        //     .attr("stop-color", "rgb(255,255,0)");
        // grad.append("stop")
        //     .attr("offset", "50%" )
        //     .attr("stop-color", "rgb(255,0,0)");
        //
        //
        // bar.append("rect")
        //         .attr("x", width-140)
        //         .attr("y", position.y+height+20)
        //         .attr("width", 130)
        //         .attr("height", height)
        //         .attr("fill", "url(#gradryg)");

        // var groupWidth = width / 52;
        // for(var i = 0; i<51; i++) {
        //     bar.append("rect")
        //     .attr("x", i * groupWidth)
        //     .attr("y",  position.y)
        //     .attr("width", groupWidth)
        //     .attr("height", height)
        //     .css("stroke", "#aaa")
        //     .css("stroke-width", 0.5)
        //     .css("fill", "none");
        // }

        // bar.scale(5.0, 1.0);
        // bar.translate(10, 0);

        return histogram;
    };

    return histogram.init();
};
