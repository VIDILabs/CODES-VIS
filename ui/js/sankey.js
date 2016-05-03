if(typeof(define) == "function") define(function(){return Sankey;});

function Sankey(option){
    "use restrict";
    var Colors = i2v.colors,
        ArrayOpt = p4.arrays;

    var option = option || {},
        svg = option.container.append('g') || {},
        data =  option.data,
        width = option.width || 600,
        height = option.height || 300,
        padding = option.padding || {left: 0, right: 0, top: 0, bottom: 0},
        nodeWidth = option.nodeWidth || 30,
        nodePadding = option.nodePadding || 10,
        // bins = option.bins || [],
        format = function(d) { return d; },
        onSelectNode = option.onSelectNode || function(){},
        onSelectLink = option.onSelectLink || function(){},
        color = Colors().set10c(),
        maxVals = [],
        size = 0,
        heightTotal = 0.9 * height,
        paddingTotal = 0.1 * height;

    // width -= padding.left + padding.right;
    // height -= padding.top + padding.bottom;

    function makeNodes(){
        var nodes = data.nodes,
            stepTotal = nodes.length,
            nodePadding,
            dy = 0,
            dx = 0;

        nodes[0].forEach(function(ni) {
            size += ni.count;
        });

        for(var step = 0; step < stepTotal; step++){
            nodePadding = paddingTotal / nodes[step].length;
            dx = step * width / (stepTotal-1);
            dy = 0;
            nodes[step].forEach(function(node, ni){
                node.dx = nodeWidth;
                node.dy = node.count  / size * heightTotal;
                if(typeof(node.x) == 'undefined') node.x = dx;
                node.y = dy;
                dy += node.dy + nodePadding;
                // dy += (maxVals[ni] / size * heightTotal + nodePadding - node.dy) / 2;
                node.outflow = [];
                node.inflow = [];
            });
        }
    }

    function makeLinks(){
        var links = data.links,
            stepTotal = links.length,
            nodes = data.nodes,
            lid = 0;

        for(var step = 0; step < stepTotal; step++){
            if(nodes.length <= step+1) break;
            links[step].forEach(function(link){
                if(typeof link.source != 'undefined' && typeof link.target != 'undefined'){
                    link.source = nodes[step][link.source];
                    link.target = nodes[step+1][link.target];

                    link.dy = link.count / size * heightTotal;
                    link.lid = lid++;
                    link.source.outflow.push(link);
                    link.target.inflow.push(link);
                }
            });
        }

        stepTotal = nodes.length;
        for(var step = 0; step < stepTotal; step++){
            nodes[step].forEach(function(node) {
                var sy = 0, ty = 0;
                node.outflow.forEach(function(link) {
                    link.sy = sy;
                    sy += link.dy;
                });
                node.inflow.forEach(function(link) {
                    link.ty = ty;
                    ty += link.dy;
                });
            });
        }

        stepTotal = links.length;
        for(var step = 0; step < stepTotal; step++){
            links[step].forEach(function(link){
                link.path = computeLinkPath(link);
            });
        }
    }

    // function computeLinkPath(d) {
    //   var xs  = d.source.x + d.source.dx*1.5,
    //       ys0 = d.source.y + d.sy,
    //       ys1 = d.source.y + d.sy + d.dy,
    // 	  xt  = d.target.x - d.target.dx/2,
    // 	  yt0 = d.target.y + d.ty,
    // 	  yt1 = d.target.y + d.ty + d.dy;
    //
    //   return ["M"+xs, ys1,
    //          "L"+xs, ys0,
    //          "L"+xt, yt0,
    //          "L"+xt, yt1,"Z"].join(" ");
    // }

    //
    function computeLinkPath(d) {
      var curvature = 0.5,
          x0 = d.source.x + d.source.dx,
          x1 = d.target.x,
        //   xi = d3.interpolateNumber(x0, x1),
          xi = function(c) { return x0 + (x1 - x0) * c },
          x2 = xi(curvature),
          x3 = xi(1 - curvature),
          y0 = d.source.y + d.sy + d.dy / 2,
          y1 = d.target.y + d.ty + d.dy / 2;
      return "M" + x0 + "," + y0
           + "C" + x2 + "," + y0
           + " " + x3 + "," + y1
           + " " + x1 + "," + y1;
    }

    function serialize(){
        var nodes = [], links = [];
        data.nodes.forEach(function(node){
            nodes = nodes.concat(node);
        });

        data.links.forEach(function(link){
            links = links.concat(link);
        });

        data = { nodes: nodes, links: links};
        // console.log(data);
    }

    makeNodes();
    makeLinks();
    serialize();
    // console.log(data);

    this.configure = function(option){
      margin = option.margin || {top: 1, right: 1, bottom: 50, left: 1};
      width =  width - margin.left - margin.right;
      height = height - margin.top - margin.bottom;
    }

    this.reload = function(newData){
        //console.log(data);
        this.data = data = newData;
        this.visualize();
    };

    this.visualize = function() {
        var sankeyLinks = svg.append("g");
        data.links.forEach(function(d){
            if(d.count>0){
                var link = sankeyLinks.append("path")
                    .attr("class", "link")
                    // .css("shape-rendering", "crispEdges")
                    .attr("d", d.path)
                    .css("stroke",  "#888")
                    .css("fill", 'none')
                    .css("stroke-width", Math.max(1.0, d.dy));
                    // .sort(function(a, b) { return b.dy - a.dy; });

                link.append("title")
                    .text( d.source.name + " → " + d.target.name + "\n(" + format(d.count) +")");

                    link.onmouseover = function() {
                        onSelectLink(d.ranks);
                        link.css("stroke", "#ffff00");
                    }

                    link.onmouseout = function() {
                        onSelectLink(d.ranks);
                        link.css("stroke", "#888");
                    }
            }
        });

        var sankeyNodes = svg.append("g");
        var node = sankeyNodes.append("g");
        var attrColor = ["red", "orange", "green"];

        data.nodes.forEach(function(d){
            if(d.count>0){
                nodeWidth = Math.max(10,nodeWidth);
                var snode = node.append("rect")
                    .attr("x", d.x)
                    .attr("y", d.y)
                    .attr("height", Math.max(1.0, d.dy))
                    .attr("width", nodeWidth)
                    .attr("class", "sankeyNode")
                    // .attr("fill", color(d.cob[0]) )
                    .attr("fill", "#000")
                    //.style("stroke", function(d) { return d3.rgb(d.color).darker(2); })
                  .append("title")
                    .text( d.name + "(" + d.count + ")");


                snode.onmouseover = function() {
                    onSelectNode(d.ranks);
                }

                var nodeTop = node.append("polygon")
                    .attr("points", [d.x+","+d.y+" "+(d.x+nodeWidth)+","+d.y+" "+d.x+","+(d.y+Math.max(1.0, d.dy))].join(" "))
                    .css("fill", 'hsl(' + Math.floor(120 * d.cob[0]) + ', 100%, 45%)')
                    // .css("stroke", "none")
                    .append("title")
                      .text( d.name + "(" + d.count + ")");

                var nodeBottom = node.append("polygon")
                    .attr("points", [(d.x+nodeWidth)+","+(d.y+Math.max(1.0, d.dy))+" "+(d.x+nodeWidth)+","+d.y+" "+d.x+","+(d.y+Math.max(1.0, d.dy))].join(" "))
                    .css("fill", 'hsl(' + Math.floor(120 * d.cob[1]) + ', 100%, 45%)')
                    // .css("stroke", "none")
                    .append("title")
                      .text( d.name + "(" + d.count + ")");

            }
        });

        sankeyNodes.translate(padding.left, padding.top);
        sankeyLinks.translate(padding.left, padding.top);

        //   .filter( function(d) { return d.x < width / 2; })
        // 	.attr("x", - nodeWidth)
        // 	.attr("text-anchor", "start");
        //
        return svg;
    }
    return this.visualize();
};
