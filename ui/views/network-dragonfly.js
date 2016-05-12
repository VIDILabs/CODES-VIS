var dependencies = [
    'js/ringchart',
    'js/ringgrid',
    'js/dragonfly-link',
    'js/histogram'
];

define(dependencies, function(ringChart, ringGrid, interLinks, histogram){
    return function networkView(arg){
        var nv = {},
            rings = [],
            histograms = [],
            option = arg || {},
            stats = option.stats || {},
            width = option.width || 620,
            height = option.height || width,
            margin = option.margin || {left: 20, right: 20, top: 20, bottom: 20},
            radius = option.radius || 100,
            stepStart = option.stepStart || 0,
            numStep = option.numStep || 1,
            container = option.container,
            repeat = option.repeat,
            numGroup = option.numGroup,
            numRouter = option.numRouter,
            numTerminal = option.numTerminal,
            routerRadix = option.routerRadix,
            struct = option.struct,
            statCharts = option.statCharts,
            onhover = option.onhover,
            jsonData;

        width -= margin.left + margin.right;
        height -= margin.top + margin.bottom;

        var links,
            linkRadius = option.linkRadius || width/4 + 10,
            svg = i2v.Svg({width: width, height: height, container: container, id: "topoView"});

        var statViewDiv = document.createElement('div');
        statViewDiv.style.position = "static";
        statViewDiv.style.margin = "30px 0 0 0";
        statViewDiv.style.display = "none";
        container.appendChild(statViewDiv);
        statCharts.forEach(function(s,si){
            histograms[si] = document.createElement('div');
            statViewDiv.appendChild(histograms[si]);
        })

        svg.setAttribute("id", "topoView");
        svg.style.position = "absolute";
        svg.style.margin = "40px 20px 20px 20px";

        var ranks = {
            terminal:{
                group: numGroup,
                router: numRouter / numGroup,
                node: numTerminal / numRouter
            },
            router: {
                group: numGroup,
                router: numRouter / numGroup,
                node: routerRadix
            }
        }

        nv.show = function(){svg.style.display = "block";};
        nv.hide = function(){svg.style.display = "none";}
        nv.change = function(view) {
            if(view == "Network") {
                statViewDiv.style.display = "none";
                nv.show();
            } else {
                nv.hide();
                statViewDiv.style.display = "block";
            }
        }

        function makeHistogram(data, s, div) {
            var histData = data[s.entity][s.granularity],
                rankMax = ranks[s.entity][s.granularity];

            histData.forEach(function(d){d.mRank = d.rank % rankMax;});
            function transform(data, attribute){
                var aggr = {$by: 'mRank'};
                aggr[attribute] = '$avg';
                return new p4.pipeline(data).group(aggr).result();
            }

            var hist = histogram({
                container: div,
                data: data[s.entity][s.granularity],
                width: width,
                height: height/3,
                vmap: {size: s.attribute},
                transform: transform,
                formatY: p4.io.printformat(".2s")
            });

            return hist;
        }

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
                radius: linkRadius,
                container: svg,
                numRouter: numRouter,
                numTerminal: numTerminal,
                numGroup: numGroup,
                numLink: routerRadix/4,
                dataRange: stats.router.node.stats
                // color: s.color || 120,
                // circle: s.circle,
            });

            var groupGrid = ringGrid({
                width: width,
                height: height,
                innerRadius: linkRadius,
                outerRadius: width/2,
                count: numGroup,
                container: svg,
                onhover: function(d) {
                    onhover(d);
                    links.select(d);
                }
            });

            //remove all highlights when the mouse leaves SVG
            groupGrid.onmouseleave = function() {
                onhover(-1);
                links.select(-1);
            }

            svgPanZoom("#topoView", {
                 zoomEnabled: true,
                 controlIconsEnabled: true,
                 fit: true,
                 center: true,
                 minZoom: 0.1
            });

            // nv.hide();

            statCharts.forEach(function(s, si){
                histograms[si].vis = makeHistogram(data, s, histograms[si]);
            });

        }

        // nv.updateStatChart = function(hid, )
        nv.update = function(stepStart, numStep){
            p4.io.ajax.get({
                url: "/timerange/" + stepStart + "/" + (stepStart+numStep),
                dataType: "json"
            }).then(function(data){
                jsonData = data;
                struct.forEach(function(s, si){
                    var result = (s.data) ? s.data : data[s.entity][s.level];
                    rings[si].update(result);
                });

                var result = new p4.pipeline(data.router.node)
                    .match({type: 2}).result();

                links.update(result);

                statCharts.forEach(function(s, i){
                    var histData = data[s.entity][s.granularity],
                        rankMax = ranks[s.entity][s.granularity];
                    histData.forEach(function(d){d.mRank = d.rank % rankMax;});
                    histograms[i].vis.update(histData);
                });
            });
        }

        nv.updateHistogram = function(i, e, g, a) {
            histograms[i].vis = null;
            histograms[i].removeChild(histograms[i].lastChild);

            histograms[i].vis = makeHistogram(jsonData, {entity: e, granularity: g, attribute: a}, histograms[i]);
        }

        p4.io.ajax.get({
            // url: "/topologydata/" + (step),
            url: "/timerange/" + stepStart + "/" + (stepStart+numStep),
            dataType: "json"
        }).then(function(json){
            // console.log(json);
            jsonData = json;
            init(json);
        });
        nv.rings = rings;
        return nv;
    }
});
