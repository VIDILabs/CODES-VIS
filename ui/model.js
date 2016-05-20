define(function(){return Model;})

function Model(arg) {
    "use strict";
    var model = {},
        option = arg || {},
        metadata = option.metadata || option.meta || null,
        binary = option.data || option.binary || null,
        cache = option.cache || false,
        datasetID = metadata.datasetID,
        ctypes = p4.ctypes.ctypes,
        entities = ["terminal", "router"],
        granularities = ["group", "router", "node"];

    if(!(metadata && binary)) throw new Error("No metadata or data loaded in Model!");

    var DataStore = {
        terminal: { group: {}, router: {}, node: {} },
        router: { group: {}, router: {}, node: {} }
    };

    if(cache){
        var offset = 0;
        entities.forEach(function(e){
            granularities.forEach(function(g) {
                var size = metadata[e][g].count,
                    types = metadata[e][g].types,
                    names = metadata[e][g].names;

                names.forEach(function(n, i) {
                    DataStore[e][g][n] = new ctypes[types[i]](
                        binary.slice(
                            offset,
                            offset+size*ctypes[types[i]].BYTES_PER_ELEMENT
                        )
                    );
                    offset += size * ctypes[types[i]].BYTES_PER_ELEMENT;
                });
            });
        });
    }

    model.select = function(query){
        var e = query.entity,
            g = query.granularity || query.granu,
            start = query.start,
            end = query.end,
            n = metadata[e][g].rankTotal,
            attributes = metadata[e][g].names,
            types = metadata[e][g].types,
            callback = query.succeed || function() {};

        if(cache) { //load data from cache
            var col = DataStore[e][g],
                size = metadata[e][g].count,
                stepTotal = metadata[e].stepTotal,
                timestampStart = metadata.sampleRate * start,
                timestampEnd = metadata.sampleRate * end,
                index = 0,
                result = {};

            attributes.forEach(function(attr, ai){
                result[attr] =  new ctypes[types[ai]](n * (end-start+1));
            });
            for(var i = 0; i < n; i++){
                for(var t = start; t<=end; t++) {
                    attributes.forEach(function(attr) {
                        result[attr][index] = col[attr][i*stepTotal+t];
                    });
                    index++;
                }
            }
            callback(result);
        } else { //get data from server backend
            p4.io.ajax.get({
                url: "/timeseries?" + ["datasetID="+datasetID, "entity="+e, "granu="+g, "start="+start, "end="+end].join("&"),
                dataType: "arraybuffer"
            }).then(function(binary){
                var size = n*(end-start+1),
                    offset = 0,
                    result = {};

                attributes.forEach(function(c, i){
                    result[c] = new ctypes[types[i]](binary.slice(offset, offset+size*ctypes[types[i]].BYTES_PER_ELEMENT));
                    offset += size * ctypes[types[i]].BYTES_PER_ELEMENT;
                });

                console.log(size, result);
                callback(result);
            });
        }
        return model;
    }

    model.aggregateByTimeRange = function(start, end, callback) {
        if(cache){
            var result = {
                terminal: { group: [], router: [], node: [] },
                router: { group: [], router: [], node: [] }
            };
            // console.log("time range", start, end);
            for(var e in DataStore){
                for(var g in DataStore[e]){
                    var md = metadata[e][g],
                        size =  md.rankTotal * (end-start),
                        names = md.names,
                        col = DataStore[e][g];

                    for(var i = 0; i<md.rankTotal; i++){
                        result[e][g][i] = {};
                        names.forEach(function(n){
                            // if(["timestamp", "rank", "group_id", "port"].indexOf(n)>-1) return
                            result[e][g][i][n] = 0;
                            for(var t = start; t < end; t++){
                                result[e][g][i][n] += col[n][i* metadata[e].stepTotal + t];
                            }
                            result[e][g][i][n] /= (end-start);

                        });
                    }
                }
            }
            callback(result);
        } else {
            p4.io.ajax.get({
                url: "/timerange/" + [datasetID, start, end].join("/"),
                dataType: "json"
            }).then(function(result){
                callback(result);
            });
        }
        return model;
    }

    return model;
}
