if(typeof(define) == "function") define(function(){return mmtsPlot;})

function mmtsPlot(arg){
    // "use strict";
    var mmts = {},
        option = arg || {},
        width = option.width || 800,
        height = option.height || 300,
        padding = option.padding || {left: 50, right: 10, top: 10, bottom: 20},
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

    var defaultColor = [0.25*alpha, 0.545*alpha, 0.667*alpha, alpha];

    var x = {}, y = {};
    x.axis = null;
    y.axis = null;
    // console.log(stats);
    // width -= padding.left+padding.right;
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
        .uniform("int", "highlight", 0)
        .uniform("float", "nodePerGroup", 1)
        .uniform("int", "groupID", 0)
        .uniform("vec2", "u_c0")
        .attribute("float", "x")
        // .attribute("float", "r")
        .attribute("float", "y");

    function vertexShader(){
        // $int.g = int(r / nodePerGroup);
        $float.px = (x * u_slope.x + u_c0.x) * 2.0 - 1.0;
        $float.py = pow(y * u_slope.y + u_c0.y, u_exponent) * 2.0 - 1.0;
        gl_Position = vec4(px, py, 0.0, 1.0);


        // if(highlight == 1){
        //     if(g == groupID) {
        //         gl_Position = vec4(px, py, 1.0, 1.0);
        //     } else {
        //         gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
        //     }
        // }
    }

    function fragShader() {
        gl_FragColor = u_color;
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

        // webgl.attribute.r = new Float32Array(mmts.data["rank"]);
        webgl.attribute.x = new Float32Array(mmts.data[vmap.x]);
        webgl.attribute.y = new Float32Array(mmts.data[vmap.y]);

        svg.clear();
        // console.log(mmts.data);
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

    mmts.highlight = function(rank, rankPerGroup, color){
        var nodePerGroup = rankPerGroup || 1;
        webgl.uniform.u_color = defaultColor;
        for(var ii = 0, l = mmts.data[vmap.y].length; ii < l; ii += mmts.timesteps){
             if(Math.floor(i / nodePerGroup) != rank) gl.drawArrays(gl.LINE_STRIP, ii, mmts.timesteps);
        }

        var a = (nodePerGroup === 1) ? 1.0 : 0.5;

        var hColor = color || [a, a, 0, a];
        webgl.uniform.u_color = hColor;
        // webgl.uniform.nodePerGroup = nodePerGroup;
        // webgl.uniform.highlight = 1;
        var lineTotal = mmts.data[vmap.y].length /  mmts.timesteps;
        // console.log(mmts.timesteps, lineTotal);
        for(var i = 0; i < lineTotal; i++){
            if(Math.floor(i / nodePerGroup) == rank) gl.drawArrays(gl.LINE_STRIP, i*mmts.timesteps, mmts.timesteps);
        }
    }

    mmts.render = function(){
        gl.clearColor(1.0,1.0,1.0,1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
        gl.enable( gl.BLEND );
        gl.blendEquation( gl.FUNC_ADD );
        gl.blendFunc( gl.ONE, gl.ONE_MINUS_SRC_ALPHA );

        var steps = mmts.data[vmap.y].length;

        webgl.uniform.u_color = defaultColor;
        webgl.uniform.u_exponent = mmts.exponent || 1.0;

        // Instanced Draw might need vertext array object
        // var ext = gl.getExtension("OES_vertex_array_object");
        // var vao = ext.createVertexArrayOES();
        // ext.bindVertexArrayOES(vao);

        // TODO: change to use instanced draw if possible
        // var ext = gl.getExtension("ANGLE_instanced_arrays");
        // gl.ext.vertexAttribDivisorANGLE(webgl.attribute.x.location, mmts.timesteps);
        // gl.ext.vertexAttribDivisorANGLE(webgl.attribute.y.location, mmts.timesteps);
        // gl.ext.vertexAttribDivisorANGLE(webgl.attribute.r.location, mmts.timesteps);
        // gl.ext.drawArraysInstancedANGLE(gl.LINE_STRIP, 0, mmts.timesteps,  steps/mmts.timesteps);

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
        return mmts;
    }
    mmts.remap();

    return mmts.render(vmap);
}
