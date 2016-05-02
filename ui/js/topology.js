function topologyGraph(option){

    var option = option || {},
        data = option.data || {},
        stats = option.stats || {},
        width = option.width || 600,
        height = option.height || width,
        container = option.container || null,
        margin = option.margin || {left: 30, right: 30, top: 30, bottom: 20},
        barWidth = width / data.length;

    // width -= margin.left + margin.right;
    // height -= margin.top + margin.bottom;

    var tg = container.append("g"),
        bar = tg.append("g");


    var groupData = data.terminal.group,
        groupStats = stats.terminal.group.stats,
        barWidth = 0.8 * width / groupData.length,
        barPadding = 0.2 * width / groupData.length,
        barHeight = 0.2 * height;


    for(var f in groupData[0]) {
        groupStats[f].slope = 1 / (groupStats[f].max - groupStats[f].min);
        groupStats[f].const = -1 / (groupStats[f].max - groupStats[f].min);
    }
    var vmap = {color: "data_size"};

    getColor =  function(d){
        var stats = groupStats;
        console.log(stats);
        var value = 120 - (d * stats[vmap.color].slope + stats[vmap.color].const) * 120;
        if(value < 0) value = -value;
        return  "hsl("+(Math.floor(value))+", 100%, 50%)";
    };

    groupData.forEach(function(d, i){
        var color = 120;
        var rect = bar.append("rect")
                .attr("x", i * barWidth + i * barPadding)
                .attr("y",  0)
                .attr("width", barWidth)
                .attr("height", barHeight)
                // .attr("stroke-width", 0.5)
                // .attr("stroke", "#777")
                .css("fill", getColor(d[vmap.color]));
    })

    tg.init = function() {
        // var len = data.length;
        // for(var i = 0; i < len; i++) {
        //     var rect = bar.append("rect")
        //         .attr("x", i * barWidth)
        //         .attr("y",  position.y)
        //         .attr("width", barWidth)
        //         .attr("height", height)
        //         .attr("stroke-width", 0.5)
        //         .attr("stroke", "#777")
        //         .attr("fill", getColor(nodes[i]));
        //         // .css("fill", getColor(sorted[i]));
        //         // .css("fill", getColor(data[i][vmap.color]));
        //
        //     rect.onmouseover = function(evt) {
        //         this.attr("stroke", "#000")
        //             .attr("stroke-width", 0.5);
        //     }
        //
        //     rect.onmouseout = function(evt) {
        //         this.css("stroke-width", 0);
        //     }
        // }
        return tg;
    };

    return tg.init();
};
