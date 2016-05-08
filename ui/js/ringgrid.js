if(typeof(define) == "function") define(function(){return ringGrid; });

function ringGrid(option){
    var option = option || {},
        width = option.width || 600,
        height = option.height || width*0.5,
        padding = option.padding || {top:20, bottom: 20, left: 40, right: 20},
        count = option.count || 8,
        container = option.container || null,
        innerRadius = option.innerRadius || 50,
        outerRadius = option.outerRadius || 100;

    var ring =  container.append("g");

    ring.onhover = option.onhover || function(){};

    ring.init = function() {
        function coord(r, rad){
            var x = width/2 + r * Math.cos(rad),
                y = height/2 + r * Math.sin(rad);
            return {x: x, y: y};
        }
        var start = 0,
            end =  2 * Math.PI,
            interval = (end - start) / count;

        for(var i = 0; i<count; i++) {
            var p1 = coord(innerRadius, start),
                p2 = coord(outerRadius, start);

            var lines = ring.append("line")
                .attr("x1", p1.x)
                .attr("y1", p1.y)
                .attr("x2", p2.x)
                .attr("y2", p2.y)
                .attr("stroke-width", 0.5)
                .attr("stroke", "#222");

            var arc = i2v.SvgArc({
                outerRadius: outerRadius,
                innerRadius: innerRadius,
                width: width,
                height: height,
                radianStart: start,
                radianEnd: start + interval,
            });

            var tc = coord(outerRadius-10, start + interval/2);
            ring.append("text")
                .attr("x", tc.x-9)
                .attr("y", tc.y+5)
                .text(i);

            var pad = ring.append("path")
                .attr("class", "arc")
                .attr("group_id", i)
                .attr("d", arc)
                .css("stroke", "orange")
                .css("stroke-width", 0)
                .css("fill", "transparent");

            pad.onmouseover = function() {
                ring.onhover(this.attr("group_id"));
                this.css("stroke-width", 2);
            }

            pad.onmouseout = function() {
                this.css("stroke-width", 0);
            }

            start += interval;
        }
        return ring;
    }
    return ring.init()
};
