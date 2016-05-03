if(typeof(define) == "function") define(function(){return mmtsPlot;})

function mmtsPlot(arg){
    // "use strict";
    var mmts = {},
        option = arg || {},
        width = option.width || 800,
        height = option.height || 300,
        padding = option.padding || {left: 50, right: 20, top: 10, bottom: 20},
        vmap = option.vmap || {},
        stats = option.stats || {},
        alpha = option.alpha || 0.2,
        container = option.container || null,
        formatX = option.formatX || function(d) { return d; },
        formatY = option.formatY || function(d) { return d; };

    mmts.exponent = option.exponent || 1;
    mmts.scale = option.scale || "power";

    mmts.ts = option.ts || {};
    mmts.data = option.data || {};
    mmts.aggregatedData = option.aggregation || {};
    mmts.timesteps = option.timesteps;
    mmts.stats = option.stats || {};
    mmts.color = option.color || "orange";

    var x = {}, y = {};
    x.axis = null;
    y.axis = null;
    // console.log(stats);
    width -= padding.right;
    // height -= padding.bottom;

    var webgl = i2v.WebGL({
        container: container,
        height: height,
        width: width,
        margin: padding
    });

    var svg = i2v.Svg({
        width: width,
        height: height,
        padding: padding,
        container: container,
    });

    var svgLayers = [];

    webgl.uniform("vec4", "u_color", [0.25, 0.545, 0.667, 1.0])
    .varying("vec4", "v_color")
        .uniform("vec2", "u_slope")
        .uniform("float", "u_exponent", 1.0)
        .uniform("int", "granularity", 1)
        .uniform("float", "nodePerGroup", 50)
        .uniform("float", "groupID", 10)
        .uniform("vec2", "u_c0")
        .attribute("float", "x")
        .attribute("float", "r")
        .attribute("float", "y");

    function vertexShader(){
        $float.g = floor(r / nodePerGroup);
        $float.px = (x * u_slope.x + u_c0.x) * 2.0 - 1.0;
        $float.py = pow(y * u_slope.y + u_c0.y, u_exponent) * 2.0 - 1.0;
        gl_Position = vec4(px, py, 0.0, 1.0);

        if(r == 51.0) {
            v_color = vec4(0.9, 0, 0, 1.0);
            gl_Position = vec4(px, py, 1.0, 1.0);
        } else {
            v_color = u_color;
        }

    }

    function fragShader() {
        gl_FragColor = v_color;
    }

    var vs = webgl.shader().vertex().function("void", "main", vertexShader).init(),
        fs = webgl.shader().fragment().require(["u_color", "v_color"]).function("void", "main", fragShader).init(),
        gl = webgl.program([vs, fs]);

    mmts.remap = function(mapping) {
        var map = mapping || {};
        for(var m in map){
            vmap[m] = map[m];
        }
        if(!vmap.hasOwnProperty("x") || !vmap.hasOwnProperty("y"))
            throw new Error("No visual mapping found for x or y !");

            var slopeX = 1 / (stats[vmap.x].max - stats[vmap.x].min),
                x0 = - stats[vmap.x].min / (stats[vmap.x].max - stats[vmap.x].min),
                slopeY = 1 / (stats[vmap.y].max - stats[vmap.y].min),
                y0 = - stats[vmap.y].min / (stats[vmap.y].max - stats[vmap.y].min);

            webgl.uniform.u_slope = [slopeX, slopeY];
            webgl.uniform.u_c0 = [x0, y0];

        webgl.attribute.r = new Float32Array(mmts.data["rank"]);

        webgl.attribute.x = new Float32Array(mmts.data[vmap.x]);
        webgl.attribute.y = new Float32Array(mmts.data[vmap.y]);
        svg.clear();

        console.log(mmts.data);

    }
    svg.clear = function(){
        svgLayers.forEach(function(layer){
            svg.removeChild(layer);
        });
        svgLayers = [];
    }

    svg.addLayer = function(layer) {
        svgLayers.push(layer);
        svg.appendChild(layer);
    }

    mmts.render = function(){

        gl.clearColor(1.0,1.0,1.0,1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
        gl.enable( gl.BLEND );
        gl.blendEquation( gl.FUNC_ADD );
        gl.blendFunc( gl.ONE, gl.ONE_MINUS_SRC_ALPHA );

        var a = alpha,
            steps = mmts.data[vmap.y].length;

        webgl.uniform.u_color = [0.25 * a, 0.545*a, 0.667*a, a];
        webgl.uniform.u_exponent = mmts.exponent || 1.0;

        for(var ii = 0; ii < steps; ii += mmts.timesteps){
             gl.drawArrays(gl.LINE_STRIP, ii, mmts.timesteps);
        }

        x = svg.axis({
            dim: "x",
            domain: [mmts.stats[vmap.x].min, mmts.stats[vmap.x].max],
            align: "bottom",
            ticks: 8,
            // tickInterval: 10000000,
            labelPos: {x: 0, y: -20},
            format: formatX
        });

        y = svg.axis({
            dim: "y",
            domain: [mmts.stats[vmap.y].min, mmts.stats[vmap.y].max],
            align: "left",
            // scale: mmts.scale,
            exponent: mmts.exponent,
            labelPos: {x: -20, y: -5},
            ticks: 7,
            format: formatY
        });

        svg.addLayer(x.show());
        svg.addLayer(y.show());


        var statsLines = svg.append("g");
        var legend = svg.append("g");
        var rankTotal = mmts.data[vmap.y].length/mmts.ts.length;
        console.log("ranktotal", rankTotal, stats);
        if(Object.keys(mmts.aggregatedData).length){
        mmts.aggregatedData[vmap.y].forEach(function(a, ai){
            var curve = i2v.svg.area({
                x: mmts.ts.map(function(d){return x(d)}),
                y: a.map(function(d){ return y(d.end);})
            });
            var grad = svg.append("defs")
                .append("linearGradient")
                .attr("id", "grad"+ vmap.y + ai.toString())
                .attr("x1", "0%")
                .attr("x2", "100%")
                .attr("y1", "0%")
                .attr("y2", "0%");
            a.map(function(t, ti){
                grad.append("stop")
                    .attr("offset", ti/a.length )
                    .attr("stop-color", mmts.color)
                    .attr("stop-opacity", t.count/rankTotal *0.9 + 0.1);

            });
            statsLines.append("path")
               .attr("d", curve())
               .attr("fill", "url(#grad"+ vmap.y + ai.toString() +")")
            //    .attr("fill-opacity", Math.pow(p4.arrays.avg(a.map(function(d){return d.count;})) / 2550, 0.5));
            //    .css("stroke-width", 1.0)
            //    .css("stroke", 'orange');

        });

        var min = Number.POSITIVE_INFINITY, max = 0;
        for(var j = 1; j<mmts.aggregatedData[vmap.y].length; j++){
            var minVal = i2v.arrays.min(mmts.aggregatedData[vmap.y][j].map(function(d){ return d.count;}));
            var maxVal = i2v.arrays.max(mmts.aggregatedData[vmap.y][j].map(function(d){ return d.count;}));
            if(minVal < min) min = minVal;
            if(maxVal > max) max = maxVal;
        }

        var legendPos = width +padding.left;
        var grad = svg.append("defs")
            .append("linearGradient")
                .attr("id", "grad"+ vmap.y +"legend")
                .attr("x1", "0%")
                .attr("x2", "0%")
                .attr("y1", "0%")
                .attr("y2", "30%");
            grad.append("stop")
                .attr("offset", "0%" )
                .attr("stop-color", mmts.color)
                .attr("stop-opacity", min/rankTotal);
            grad.append("stop")
            .attr("offset", "100%" )
            .attr("stop-color", mmts.color)
            .attr("stop-opacity", 1.0);

        legend.append("rect")
            .attr("x", legendPos)
            .attr("y", 20)
            .attr("width", 10)
            .attr("height", 0.5*height)
            .css("fill","url(#grad"+ vmap.y +"legend)");

        legend.append("text")
            .attr("x", legendPos)
            .attr("y", 15)
            .css("fill", "#222")
            .css("font-size", ".9em")
            .text(formatY(min));

            legend.append("text")
                .attr("x", legendPos)
                .attr("y", 0.5*height+35)
                .css("fill", "#222")
                .css("font-size", ".9em")
                .text(formatY(max));


        statsLines.translate(padding.left, padding.top);
        }
        // var d= mmts.aggregatedData[vmap.y]
        //     var curve = i2v.svg.area({
        //         x: mmts.ts.concat(mmts.ts.reverse()),
        //         y: d[0].map(function(d){ return y(d.end);}).concat(d[1].map(function(d){ return y(d.end);}).reverse())
        //     });
        //     var grad = svg.append("defs")
        //         .append("linearGradient")
        //         .attr("id", "grad")
        //         .attr("x1", "0%")
        //         .attr("x2", "100%")
        //         .attr("y1", "0%")
        //         .attr("y2", "0%");
        //     mmts.ts.forEach(function(t, ti){
        //         grad.append("stop")
        //             .attr("offset", ti/mmts.ts.length )
                    // .attr("stop-color", 'hsl(240, ' + d[0][t].count/2550*100+ '%, 40%)')
        //             .attr("stop-opacity", 1);
        //
        //     });
        //     statsLines.append("path")
        //        .attr("d", curve())
        //        .attr("fill", "url(#" + "grad")
        //     //    .attr("fill-opacity", Math.pow(p4.arrays.avg(a.map(function(d){return d.count;})) / 2550, 0.5));
        //     //    .css("stroke-width", 1.0)
        //     //    .css("stroke", 'orange');

        return mmts;
    }
    mmts.remap();

    return mmts.render(vmap);
}
