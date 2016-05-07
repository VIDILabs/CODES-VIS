var dependencies = [
    'js/ringchart',
    'js/ringgrid',
    'js/dragonfly-link'
];

define(dependencies, function(ringChart, ringGrid, interLinks){
    return function networkView(arg){
        var nv = {},
            rings = [],
            option = arg || {},
            stats = option.stats || {},
            width = option.width || 620,
            height = option.height || width,
            radius = option.radius || 100,
            stepStart = option.stepStart || 0,
            numStep = option.numStep || 1,
            container = option.container,
            repeat = option.repeat,
            numGroup = option.numGroup,
            numRouter = option.numRouter,
            numTerminal = option.numTerminal,
            struct = option.struct;

        var svg = i2v.Svg({width: 640, height: 640, container: container, id: "topoView"}),
            links;

        svg.setAttribute("id", "topoView");
        svg.style.position = "absolute";
        svg.style.margin = "20px 0 0 0";

        nv.show = function(){svg.style.display = "block";};
        nv.hide = function(){svg.style.display = "none";}

        function init(data){
            struct.forEach(function(s){
                var result = (s.data) ? s.data : data[s.entity][s.level];
                // console.log(result.length);
                var ring = ringChart({
                    data: result,
                    vmap: s.vmap,
                    width: width,
                    height: height,
                    outerRadius: s.radius + s.thick,
                    innerRadius: s.radius,
                    color: s.color || 120,
                    circle: s.circle,
                    container: svg,
                    dataRange: stats[s.entity][s.level].stats
                });

                rings.push(ring);
            })

            var result = new p4.pipeline(data.router.node)
                .match({type: 2}).result();
            // console.log(links);

            links = interLinks({
                data: result,
                vmap: {color: "traffic"},
                width: width,
                height: height,
                radius: 160,
                container: svg,
                numRouter: numRouter,
                numTerminal: numTerminal,
                numGroup: numGroup,
                dataRange: stats.router.node.stats
                // color: s.color || 120,
                // circle: s.circle,
            });
            var gg = ringGrid({
                width: 620,
                height: 620,
                innerRadius: 160,
                outerRadius: 310,
                count: numGroup,
                container: svg
            });
        }

        nv.update = function(stepStart, numStep){
            p4.io.ajax.get({
                url: "/timerange/" + stepStart + "/" + (stepStart+numStep),
                dataType: "json"
            }).then(function(data){

                struct.forEach(function(s, si){
                    var result = (s.data) ? s.data : data[s.entity][s.level];
                    rings[si].update(result);
                });

                var result = new p4.pipeline(data.router.node)
                    .match({type: 2}).result();

                links.update(result);
            });
        }

        p4.io.ajax.get({
            // url: "/topologydata/" + (step),
            url: "/timerange/" + stepStart + "/" + (stepStart+numStep),
            dataType: "json"
        }).then(function(json){
            console.log(json);
            init(json);
        });
        nv.rings = rings;
        return nv;
    }
});
