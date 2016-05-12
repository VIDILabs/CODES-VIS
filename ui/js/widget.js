var deps = ['vui/panel', 'vui/dropdown', 'js/mmts', 'js/glHeatmap'];

define(deps, function(Panel, DropDownMenu, mmtsPlot, glHeatmap){
    return function Widget(arg) {
        'use strict;'
        var widget = {},
            option = arg || {},
            width = option.width || 800,
            padding = option.padding || {left: 50, right: 10, top: 10, bottom: 30},
            height = option.height || 360,
            container = option.container || null,
            attributes = option.attributes || [],
            selectedAttribute = option.selectedAttribute || 0,
            onchange = option.onchange || function() {},
            menu = {},
            plot,
            entity = option.entity || "terminal",
            granularity = option.granularity || "node",
            metadata = option.metadata,
            changeSelectedAttriubte = false,
            visualizations = {
                "time series": mmtsPlot,
                "heatmap": glHeatmap
            },
            selectVis = "time series";

        var panel = Panel({
            container: container,
            width: width + padding.left + padding.right,
            height: height + padding.top + padding.bottom,
            header: true,
        });

        menu.vis = DropDownMenu({
            container: panel.header,
            options: ["time series", "heatmap"],
            selected: 0,
            label: "Visualization",
            // float: "right"
        }).onchange = function(vis) {
            selectVis = vis;
            onchange(widget);
        };

        menu.entity = DropDownMenu({
            container: panel.header,
            options: ["terminal", "router"],
            selected: 0,
            label: "Entity",
            float: "right"
        }).onchange = function(d) {
            entity = d;
            changeSelectedAttriubte = true;
            onchange(widget, entity, granularity);
        };

        menu.granularity = DropDownMenu({
            container: panel.header,
            options: [ "group", "router", "node/port"],
            selected: [ "group", "router", "node"].indexOf(granularity),
            label: "Granularity",
            float: "right"
        })

        menu.granularity.onchange = function(d) {
            granularity = d.split("/")[0];
            onchange(widget, entity, granularity);
        };
        menu.attribute = DropDownMenu({
            container: panel.header,
            options: attributes,
            selected: selectedAttribute,
            label: "Attribute",
            float: "right"
        });

        menu.attribute.onchange = function(d){
            selectedAttribute = attributes.indexOf(d);
            // plot.remap({ x: "timestamp", y: d});
            // plot.render();
            onchange(widget);
        };
        // menu.vis = DropDownMenu({
        //     container: panel.header,
        //     options: ["time series", "area", "heat map"],
        //     selected: 0,
        //     label: "plot",
        // });
        widget.onchange = function(f) {
            onchange = f;
        };

        widget.changeAttributes = function(attr) {
            attributes = attr;
            if(changeSelectedAttriubte || selectedAttribute >= attr.length) {
                selectedAttribute = 0;
                menu.attribute.changeOptions(attr, 0);
                changeSelectedAttriubte = false;
            } else {
                menu.attribute.changeOptions(attr);
            }

            return attributes[selectedAttribute];
        };

        widget.visualize = function(arg){
            var data = arg.data,
                ts = arg.ts,
                numStep = arg.steps,
                vmap =  {x: "timestamp", y: attributes[selectedAttribute]};

            var alpha = {group: 0.5, router: 0.25, node: 0.1};
            // console.log(attributes);
            var stats = p4.ctypes.query.stats(data[entity][granularity], attributes);
            // console.log(stats);
            stats.timestamp = {max: ts[ts.length-1], min: ts[0]};

            plot = visualizations[selectVis]({
                data: data[entity][granularity],
                stats: stats,
                width: width,
                height: height,
                // exponent: exponent,
                vmap: vmap,
                container: panel.body,
                timesteps: numStep,
                ts: ts,
                alpha: alpha[granularity],
                // color: tsColor(attributes[0]),
                // aggregation: binAggregatedData,
                formatX: function(d) { return p4.io.printformat(".3s")(d / 1000000) + "ms"; },
                formatY: p4.io.printformat(".2s")
            });

            widget.highlight = plot.highlight;
        }

        widget.entity = function() {
            return entity;
        }

        widget.granularity = function() {
            return granularity;
        }

        widget.attribute = function() {
            return attributes[selectedAttribute];
        }

        widget.clear = panel.clear;
        widget.menu = menu;

        return widget;
    };
});
