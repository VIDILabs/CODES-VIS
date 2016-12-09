var deps = [
    'i2v/viz',
    'i2v/svg/axis',
    'i2v/format',
    'p4/core/arrays',
    'i2v/selector',
    'flexgl/flexgl'
]

define(deps, function(Viz, axis, format, arrays, Selector, FlexGL){
    // "use strict";
    var seq = arrays.seq;

    return Viz.extend(function(option){
        var self = this,
            svg = this.$svg(),
            features = option.features,
            vmap = option.vmap,
            title = option.title,
            colors = option.colors || ["blue"],
            domains = option.domains,
            plot = svg.append("g"),
            numRows = option.size || this.data.size,
            numDims = features.length,
            selectors = plot.append("g"),
            matrixData = option.matrix,
            size = option.group,
            pCoord = svg.append("g"),
            labels = svg.append("g");

        var fgl = new FlexGL({
            width: this.$width,
            height: this.$height,
            padding: this.$padding,
        });
        var rawData = this.data,
            texData = new Float32Array(numRows * numDims);


        var axisDist = this.$width * 0.7 / (numDims-1),
            filterFlag = 0,
            yAxis = new Array(numDims),
            filterDim = new Array(numDims).fill(0),
            filterRanges = new Array(numDims).fill([0,0]);

        var alpha = 0.15;
        fgl.uniform("coef", "vec2", [1/(numRows-1), 1/(numDims-1)])
            .uniform( "uColor", "vec4", [0.1*alpha, 0.5*alpha, 0.667*alpha, alpha])
            .uniform("domains", "vec2", new Array(numDims*2).fill(0))
            .uniform("filterFlag", "int", 0)
            .uniform("mode", "float", 1)
            .uniform("filterDim", "int", filterDim)
            .uniform("filterRanges", "vec2", fgl.uniform.serialize(filterRanges))
            .attribute("dimension", "float",  new Float32Array(seq(0,numDims-1)))
            .attribute("row", "float",  new Float32Array(seq(0, numRows-1)))
            .framebuffer("filter", "float", [numRows, 1])
            .varying("filterResult", "float")
            .texture("data", "float", texData, [numRows, numDims]);

        var texData = this.data;

        features.forEach(function(f, i){
            fgl.texture.data.update(new Float32Array(texData[f]), [0, i], [numRows, 1]);
        });

        features.forEach(function(f, i){
            var axisOption = {
                container: pCoord,
                height: self.$height,
                width: self.$width,
                align: "left",
                position: i * axisDist,
                dim: "y",
                domain: domains[f],
                tickInterval: "auto",
                ticks: Math.ceil(self.$height / 50),
                labelPos: {x: -5, y: -4},
                padding: {left: 0, right: 0, top: 0, bottom: 0},
                format: format(".3s")
            };
            // if(i == 0) axisOption.autoHide = true;
            yAxis[i] = axis(axisOption);

            var axisSelect = selectors.append("g")
                .translate( axisDist * (i-0.1), 0);

            new Selector({
                container: axisSelect,
                width: axisDist * 0.2,
                height: self.$height,
                y: yAxis[i].invert,
                brushstart: function(d) {
                    if(filterFlag === 0) fgl.uniform.filterFlag = 1;
                    filterDim[i] = 1;

                    fgl.uniform.filterDim = filterDim;
                },
                brush: function(d) {
                    filterRanges[i] = d.y;
                    fgl.uniform.filterRanges = fgl.uniform.serialize(filterRanges);
                    // var start = new Date();6

                    compute();
                    render();
                    // console.log(new Date() - start);
                },
                brushend: function(d) {
                    compute();
                    render();

                }
            })

            labels
            .append("text")
              .attr("y", 0)
              .attr("x", self.$padding.left + i * axisDist)
              .attr("dy", "1em")
              .css("text-anchor", "middle")
              .css("font-size", "0.9em")
              .text(f.split("_").join(" "));
        })


        plot.translate(this.$width*0.3 + this.$padding.left, this.$padding.top);
        pCoord.translate(this.$width*0.3 + this.$padding.left, this.$padding.top);
        labels.translate(this.$width*0.3, 0);


        fgl.shader.vertex(function(coef, domains, dimension, row, data, filterFlag, filter, filterResult) {
            var x, y, r, d, value;

            $int(i);
            i = int(dimension);
            r = row * coef.x;
            d = dimension * coef.y;
            x = d * 2.0 - 1.0;
            value = (texture2D(data, vec2(r, d)).a - domains[i].x) / (domains[i].y - domains[i].x);
            y =  value * 2.0 - 1.0;
            filterResult = 1.0;
            if(filterFlag == 1)
                filterResult = texture2D(filter, vec2(r, 0)).r;

            gl_Position = vec4(x, y, 0.0, 1.0);
        });

        fgl.shader({type:"vertex", debug: "true", name: "filter"},
        function filter(coef, row, dimension, data, filterResult, filterDim, filterRanges) {
            var x, r, d, value;
            gl_PointSize = 1.0;
            filterResult = 1.0;
            r = row * coef.x;

            $int(i);
            i = int(dimension);

            if(filterDim[i] == 1) {
                d = dimension * coef.y;
                value = texture2D(data, vec2(r, d)).a ;
                if( value > filterRanges[i].x || value < filterRanges[i].y)
                    filterResult = 0.0;
            }
            var inverted_width = coef.x / (coef.x + 1.0);
            x = (row+0.5) * inverted_width * 2.0 - 1.0;
            // x = r * 2.0 - 1.0;
            gl_Position = vec4(x, 0, 0.0, 1.0);
        });

        fgl.shader.fragment(function fsFilter(filterResult) {
            gl_FragColor = vec4(filterResult);
        });


        fgl.shader.fragment(function(uColor, filterResult, mode) {
            if(filterResult == mode)
                discard;
            gl_FragColor = uColor;
        });

        fgl.program("filter", "filter", "fsFilter");
        fgl.framebuffer.enableRead("filter");
        fgl.program("parallelCoordinate");
        fgl.uniform.domains = fgl.uniform.serialize(yAxis.map(function(d){return d.domain();}));


        function render() {
            var gl = fgl.program("parallelCoordinate");
            gl.ext.vertexAttribDivisorANGLE(fgl.attribute.dimension.location, 0);
            gl.ext.vertexAttribDivisorANGLE(fgl.attribute.row.location, 1);
            gl.viewport(0.3*fgl.canvas.width, 0, fgl.canvas.width*0.7, fgl.canvas.height);
            gl.clearColor( 1.0, 1.0, 1.0, 1.0 );
            gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
            gl.enable( gl.BLEND );
            gl.blendEquation( gl.FUNC_ADD );
            gl.blendFunc( gl.ONE, gl.ONE_MINUS_SRC_ALPHA );

            fgl.uniform.mode = 1.0;
            fgl.uniform.uColor = [0.85, 0.85, 0.85, 0.95];
            gl.ext.drawArraysInstancedANGLE(gl.LINE_STRIP, 0, numDims, numRows);

            fgl.uniform.mode = 0.0;
            fgl.uniform.uColor = [0.5*alpha, 0.1*alpha, 0.667*alpha, alpha];

            gl.ext.drawArraysInstancedANGLE(gl.LINE_STRIP, 0, numDims, numRows);
            // gl.finish();

        }

        function compute() {
            fgl.bindFramebuffer("filter");
            var gl = fgl.program("filter");
            gl.viewport(0, 0, numRows, 1);
            gl.clearColor( 1.0, 1.0, 1.0, 1.0 );
            gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
            gl.disable(gl.CULL_FACE);
            gl.disable(gl.DEPTH_TEST);
            gl.enable( gl.BLEND );
            gl.blendFunc( gl.ONE, gl.ONE );
            gl.blendEquation(gl.MIN_EXT);
            gl.ext.vertexAttribDivisorANGLE(fgl.attribute.dimension.location, 0);
            gl.ext.vertexAttribDivisorANGLE(fgl.attribute.row.location, 1);
            gl.ext.drawArraysInstancedANGLE(gl.POINTS, 0, numDims, numRows);
            // gl.drawArrays(gl.POINTS, 0, numRows);
            // var result = new Float32Array(numRows*4);
            // gl.readPixels(0, 0, numRows, 1, gl.RGBA, gl.FLOAT, result);
            // result.forEach(function(d, i){
            //     if(i%4==0 && d == 1) console.log(i/4, d);
            // })
            // gl.finish();
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
        render();

        var size = option.group,
            min = matrixData.reduce(function(a, b) { return Math.min(a, b);}),
            max = matrixData.reduce(function(a, b) { return Math.max(a, b);});

        var matrixPlot = svg.append("g");


        fgl.uniform("dim", "vec2", fgl.dimension())
            .uniform("box", "vec2", [0, 0, 0, 0])
            .uniform("select", "int", 0)
            .uniform("coe", "vec2", [-min/(max-min), 1/(max-min)])
            .attribute("pos", "vec2",  new Float32Array([
                -1.0, -1.0,
                 1.0, -1.0,
                -1.0,  1.0,
                -1.0,  1.0,
                 1.0, -1.0,
                 1.0,  1.0
            ]))
            .texture("matrix", "float", new Float32Array(matrixData), [size, size]);

        fgl.shader.vertex(function hvs(pos) {
             gl_Position = vec4(pos, 0, 1);
        });

        fgl.shader.fragment(function hfs(dim, coe, matrix, select, box) {
            var a, x, y;
            x = (gl_FragCoord.x+0.5) / dim.x;
            y = 1.0 - (gl_FragCoord.y+0.5) / dim.y;
            a = texture2D(matrix, vec2(x, y)).a;
            a = pow(a * coe.y, 0.2) + coe.x;

            $bool(selected) = true;

            if(select == 1) {
                if(
                    gl_FragCoord.x < box[0].x ||
                    gl_FragCoord.x > box[0].y ||
                    dim.y - gl_FragCoord.y < box[1].x ||
                    dim.y - gl_FragCoord.y > box[1].y
                )
                    selected = false;
            }



            if(selected)
                gl_FragColor = vec4(0.9, 0.0, 0.9, a);
            else
                gl_FragColor = vec4(0.0, 0.0, 0.0, a);
        });



        var xAxis = axis({
            container: matrixPlot,
            align: "bottom",
            dim: "x",
            scale: "ordinal",
            domain: seq(0, size-1),
            ticks: 10,
            width: self.$width*0.3,
            height: self.$height,
            labelPos: {x: 0, y: -20},
            padding: {left: 0, right: 0, top: 0, bottom: 0},
            // grid: 1,
            // format: format(".3s")
        });

        var yAxis = axis({
            container: matrixPlot,
            dim: "y",
            align: "left",
            scale: "ordinal",
            domain: seq(0, size-1).reverse(),
            ticks: 10,
            width: self.$width*0.3,
            height: self.$height,
            labelPos: {x: -5, y: -4},
            padding: {left: 0, right: 0, top: 0, bottom: 0},
            // format: format(".3s")
        });

        function update(d) {
            fgl.uniform.box = fgl.uniform.serialize([d.x, d.y]);
            renderMatrix();
        }

        new Selector({
            container: matrixPlot,
            width: self.$width * 0.3,
            height: self.$height,
            color: "#DDD",
            x: true,
            y: true,
            brushstart: function(d) { fgl.uniform.select = 1;},
            brush: update,
            brushend: update
        })

        matrixPlot.translate(this.$padding.left, this.$padding.top);

        function renderMatrix() {
            var gl = fgl.program("heatmap", "hvs", "hfs");
            gl.viewport(0, 0, self.$width*0.3, self.$height);
            // gl.clearColor( 0.0, 0.0, 0.0, 0.0 );
            // gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }

        renderMatrix();

        this.canvas.push(fgl.canvas);
        this.render(svg);
    });
});
