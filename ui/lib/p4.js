(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = new Arrays();

function Arrays() {
    "use strict;"
    function _reduce(array, opt) {
        var i,
            len = array.length,
            fn,
            result;

        switch (opt) {
            case "max":
                result = array.reduce(function(a, b) {
                    return (a > b) ? a : b;
                });
                break;
            case "min":
                result = array.reduce(function(a, b) {
                    return (a < b) ? a : b;
                });
                break;
            case "and":
            case "&":
                result = array.reduce(function(a, b) {
                    return a & b;
                });
                break;
            case "or":
            case "|":
                result = array.reduce(function(a, b) {
                    return a | b;
                });
                break;
            case "mult":
            case "*":
                result = array.reduce(function(a, b) {
                    return a * b;
                });
                break;
            default: // "sum" or "+"
                result = array.reduce(function(a, b) {
                    return a + b;
                });
                break;
        }

        return result;
    }

    this.reduce = function(opt) {
        return function(array) {
            var a = (array instanceof Array) ? array : Array.apply(null, arguments);
            return _reduce(a, opt);
        };
    };

    this.avg = function(array) {
        return _reduce(array, "+") / array.length;
        // return array.reduce(function(a,b){ return 0.5 * (a + b)});
    };

    this.normalize = function(array) {
        var max = _reduce(array, "max"),
            min = _reduce(array, "min"),
            range = max - min;

        return array.map(function(a){
            return (a - min) / range;
        });
    }

    this.seq = function(start, end, intv) {
        var interval = intv || 1,
            array = [];

        for(var i=start; i<=end; i+=interval)
            array.push(i);

        return array;
    };

    var that = this,
        fns = ["max", "min", "mult", "and", "or"];

    fns.forEach(function(f) {
        that[f] = that.reduce(f);
    });

    this.sum = this.reduce("+");

    this.scan = this.pfsum = function(a){
        var pfsum = [],
            accum = 0;

        for (var i = 0; i < a.length; i++) {
            accum += a[i];
            pfsum.push(accum);
        }

        return pfsum;
    };

    this.iscan = function(a) {
        return this.scan([0].concat(a));
    };

    this.diff = function(a, b) {
        var difference = [];
        a.forEach(function(d){
            if (b.indexOf(d)===-1) {
                difference.push(d);
            }
        });
        return difference;
    };

    this.intersect = function(a, b) {
        var t;
        if (b.length > a.length) t = b, b = a, a = t; // indexOf to loop over shorter
        return a.filter(function (e) {
                if (b.indexOf(e) !== -1) return true;
        });
    };

    this.unique = function(a) {
        return a.reduce(function(b, c) {
            if (b.indexOf(c) < 0) b.push(c);
            return b;
        }, []);
    };

    this.lcm = function(A) {
        var n = A.length, a = Math.abs(A[0]);
        for (var i = 1; i < n; i++) {
            var b = Math.abs(A[i]), c = a;
            while (a && b){ (a > b) ? a %= b : b %= a; }
            a = Math.abs(c*A[i])/(a+b);
        }
        return a;
    };

    this.stats = function(array){
        return {
            max: _reduce(array, "max"),
            min: _reduce(array, "min"),
            avg: this.avg(array)
        };
    };

    this.histogram = function(array, bins, _max, _min) {
        var l = array.length,
            min = (typeof(_min) == 'number') ? _min : _reduce(array, "min"),
            max = (typeof(_max) == 'number') ? _max : _reduce(array, "max"),
            range = max - min,
            interval = range / bins,
            hg = new Array(bins+1).fill(0);

        for(var i = 0; i < l; i++){
            hg[Math.floor( (array[i] - min) / range * (bins)) ]++;
        };

        hg[bins-1] += hg[bins];
        return hg.slice(0,bins);
    }

    this.var = function(array) {
        var m = _reduce(array, "+") / array.length,
            va = array.map(function(a){ return Math.pow(a-m, 2) });

        return _reduce(va, "+") / (array.length - 1);
    }

    this.std = function(array) {
        return Math.sqrt(that.var(array));
    }
}

},{}],2:[function(require,module,exports){
module.exports = function DataStruct(arg){
    "use strict;"
    var ds = {},
        array = arg.array || [],
        header = arg.header || array[0],
        types = arg.types || [],
        skip = arg.skip || 0,
        parsers = [],
        data = arg.data || [];

    if(types.length && typeof(types) == 'string'){
        var ta = [];
        for (var i = 0; i < header.length; i++) {
            ta.push(types);
        }
        types = ta;
    }

    if(typeof skip == "number") {
        for(var j = 0; j<skip; j++)
            array.shift();
    }

    types.forEach(function(t){
        parsers.push(getParser(t));
    })

    function parseDate(input) {
      var parts = input.split('-');
      return new Date(parts[0], parts[1]-1, parts[2]);
    }

    function getParser(type){
        if(type == "int") {
            return function(value){ return parseInt(value); };
        } else if(type == "float") {
            return function(value){ return parseFloat(value); };
        } else if(["date", "time", "datetime"].indexOf(type)!=-1) {
            return function(value){ return new Date(value); };
            // return parseDate(value);
        } else if(["money", "price", "cost"].indexOf(type)!=-1) {
            return function(value){ return parseFloat(value.substring(1)); };
        } else {
            return function(value){ return value; };
        }
    }

    ds.objectArray = function(){
        array.forEach(function(a){
            var o = {};
            header.forEach(function(k,i){
                if(k.length) {
                    o[k] = parser[i](a[i]);
                }
            });
            data.push(o);
        });
        return data;
    }

    ds.rowArray = function(){
        array.forEach(function(a){
            var row = [];
            header.forEach(function(k,i){
                if(k.length) {
                    row.push(parser[i](a[i]));
                }
            });
            data.push(row);
        });
        return data;
    }

    //TODO: make columnArray extensible like rowArray and objectArray
    ds.columnArray = function() {
        header.forEach(function(k,i){
            var column = array.map(function(a){
                return a[i];
            });
            data.push(column);
        });
        return data;
    }

    return ds;
};

},{}],3:[function(require,module,exports){
module.exports = Pipeline;
var Queries = require('../dataopt/query.js'),
    Transform = require('../dataopt/transform.js');

function combine(ob1, ob2) {
    Object.keys(ob2).forEach(function(k){
            ob1[k] = ob2[k];
    });

    return ob1;
}

function Pipeline(input){
    var that = this,
        data = input.slice() || [],
        cache = {},
        result;

    Object.keys(Queries).forEach(function(opt) {
        that[opt] = function(a) {
            result =  Queries[opt](data, a);
            data = result; //write back
            return that;
        };
    });

    this.transform = this.project = function(opt) {
        data = result = Transform(data, opt);
        return that;
    };

    this.cache = function(tag){
        cache[tag] = result;
        return that;
    };

    this.data = function(d) {
        data = d.slice(); //hard copy
        return that;
    };

    this.result = function() {
        return result;
    };

    this.map = function(f){
        result = data.map(f);
        data = result;
        return that;
    };
}

},{"../dataopt/query.js":7,"../dataopt/transform.js":9}],4:[function(require,module,exports){
var ctypes = require("./ctypes.js");

module.exports = function ColumnStore(option){
    "use strict";
    var cstore   = {},
        size     = option.size  || 0,   // max size
        count    = option.count || 0,   // number of entries stored
        types    = option.types || [],  // types of the columns
        names    = option.names || [],  // column names
        CAMs     = option.CAMs  || {},  // content access memory
        TLBs     = option.TLBs  || {},  // table lookaside buffer
        columns  = {},                  // column-based binary data
        colStats = {},
        colAlloc = {},
        colRead  = {};                  // functions for reading values

    if(option.struct) struct(option.struct);

    function init() {
        if(size > 0 && types.length === names.length && types.length > 0) {
            names.forEach(function(c, i){
                configureColumn(i);
                columns[c] = new colAlloc[c](size);
            });
            // allocate memory for all columns at once
            // var bytesTotal = 0;
            // names.forEach(function(c, i){
            //     configureColumn(i);
            //     bytesTotal += size * ctypes[types[i]].BYTES_PER_ELEMENT;
            // });
            // buffer = new ArrayBuffer(bytesTotal);
        }
        return cstore;
    }

    function struct(struct) {
        for(var k in struct){
            names.push(k);
            types.push(struct[k]);
            // colAlloc[names[k]] = ctypes[struct[k]];
        }
        return init();
    }

    function configureColumn(cid) {
        if(typeof(cid) == "string") cid = names.indexOf(cid);
        var f = names[cid];
        colAlloc[f] = ctypes[types[cid]];

        if(colAlloc[f] === ctypes.string){
            TLBs[f] = [];
            CAMs[f] = {};
            colRead[f] = function(value) {
                if(!CAMs[f][value]){
                    TLBs[f].push(value);
                    CAMs[f][value] = TLBs[f].length;
                    return TLBs[f].length;
                } else {
                    return CAMs[f][value];
                }
            };
        } else if(colAlloc[f] === ctypes.int || colAlloc[f] === ctypes.short) {
            colRead[f] = function(value) {  return parseInt(value) };
        } else if(colAlloc[f] === ctypes.float){
            colRead[f] = function(value) {  return parseFloat(value) };
        } else if(colAlloc[f] === ctypes.double) {
            //TODO: check precision for double, do the best for double (maybe limited by Javascript), Use BIG Number?
            colRead[f] = function(value) {  return Number(value); };
        } else {
            throw new Error("Invalid data type for TypedArray data!")
        }

    }

    cstore.addRows = function(rowArray) {
        rowArray.forEach(function(row){
            row.forEach(function(v,j){
                columns[names[j]][count] = colRead[names[j]](v);
            });
            count++;
        });
        return count;
    }

    cstore.addColumns = function(columArray, columnName, columnType) {
        var cid = names.indexOf(columnName);
        if( cid < 0) {
            names.push(columnName);
            types.push(columnType);
            configureColumn(columnName);
            cid = types.length - 1;
        }

        if(columnArray instanceof types[cid]) {
            columns[columnName] = columnArray;
        } else if(ArrayBuffer.isView(columnArray)){
            columns[columnName] = new colAlloc[columnName](columnArray);
        } else {
            throw new Error("Error: Invalid data type for columnArray!");
        }
        count = columnArray.length;
    }

    cstore.size = function(N) {
        size = N;
        return init();
    }

    cstore.types = function(ctypes) {
        types = ctypes;
        return init();
    }

    cstore.names = function(colNames) {
        names = colNames;
        return init();
    }

    cstore.struct = struct;

    cstore.metadata = cstore.info = function() {
        return {
            size: size,
            count: count,
            names: names,
            types: types,
            // widths: types.map(function(t){return t.BYTES_PER_ELEMENT;}),
            TLBs: TLBs,
            CAMs: CAMs
        }
    }

    cstore.data = cstore.columns = function() {
        return columns;
    }

    cstore.stats = function(col){
        col.forEach(function(c){
            if(!colStats[c]){
                var min = max = avg = columns[c][0];

                for(var i = 1; i < count; i++){
                    var d = columns[c][i];
                    if(d > max) max = d;
                    else if(d < min) min = d;
                    avg = avg - (avg-d) / i;
                }

                colStats[c] = {min: min, max: max, avg: avg};
            }
        })

        return colStats;
    }

    return init();
}

},{"./ctypes.js":5}],5:[function(require,module,exports){
module.exports = {
    int    : Int32Array,
    short  : Int16Array,
    float  : Float32Array,
    double : Float64Array,
    string : Uint8Array
}

},{}],6:[function(require,module,exports){
module.exports = (function Query(){
    "use strict;"
    var query = {};

    query.stats = function(data, col){
        var stats = {};
        col.forEach(function(c){
            var len = data[c].length,
                min = max = avg = data[c][0];

            for(var i = 1; i < len; i++){
                var d = data[c][i];
                if(d > max) max = d;
                else if(d < min) min = d;
                avg = avg - (avg-d) / i;
            }
            stats[c] = {min: min, max: max, avg: avg};
        });
        return stats;
    }

    return query;
})();

},{}],7:[function(require,module,exports){
module.exports = (function Query(){
    var query = {},
        ArrayOpts = require("../core/arrays.js");

    function _match(obj, spec, indexes){
        var match,
            opt,
            index,
            sat = true,
            keys = Object.keys(spec);

        keys.forEach(function(key){
            if(key === "$not") {
                match = !_match(obj, spec[key], indexes);
            } else if(key == "$or" || key == "$and" ) {
                match = (key == "$and");
                spec[key].forEach(function(s){
                    match = (key == "$and") ? match & _match(obj, s, indexes) : match | _match(obj, s, indexes);
                });
            } else {
                index = (indexes.length > 0) ? indexes.indexOf(key) : key;

                if(typeof spec[key] === 'object'){
                    opt = Object.keys(spec[key])[0];

                    if(opt[0] == "$" && spec[key][opt] instanceof Array){
                        if(opt == "$in" || opt == "$nin"){
                            match = ((opt == "$nin") ^ (spec[key][opt].indexOf(obj[index]) > -1));
                        } else if(opt == "$inRange"){
                            match =(obj[key] > spec[key][opt][0] & obj[index] < spec[key][opt][1]);
                        } else if(opt == "$ninRange"){
                            match =(obj[key] < spec[key][opt][0] | obj[index] > spec[key][opt][1]);
                        } else if(opt == "$inDate"){
                            match = (spec[key][opt].map(Number).indexOf(+(obj[index])) > -1);
                        }
                    }

                } else {

                    if(spec[key][0] === "$")
                        match = (obj[spec[key].slice(1)] === obj[index]);
                    else
                        match = (spec[key] == obj[index]);
                }
            }
            sat = sat & match;
        });

        return sat;
    }

    query.match = function(data, spec) {
        var indexes = data[0];

        if(!Array.isArray(indexes)) indexes = [];

        return data.filter(function(a){
            if(_match(a, spec, indexes)) return a;
        });
    };

    query.indexBy = function(data, id){
        var indexed = {};

        data.forEach(function(d){

            if(!indexed.hasOwnProperty(d[id])){
                indexed[d[id]] = [ d ];
            } else {
                indexed[d[id]].push(d);
            }
            // delete d[id];
        });

        return indexed;
    };

    // query.list = function(data, id) {
    //     return data.map(function(d){return d[id];});
    // }

    query.range = function(data, id) {
        var array = data.map(function(d){return d[id];});
        return [ ArrayOpts.min(array), ArrayOpts.max(array) ];
    };

    query.map = function(data, m) {
        var mf = function(d){return d};
        if(typeof m === "string")
            mf = function(d){return d[m]};
        else if(typeof m === "function")
            mf = m;

        return data.map(mf);
    };

    Object.keys(ArrayOpts).forEach(function(opt) {
        query[opt] = function(data, id) {
            var arr = query.map(data, id);
            return ArrayOpts[opt](arr);
        }
    });

    query.group = function(array, spec){
        var i,
            l = array.length,
            keys = Object.keys(spec),
            bin,
            bins = [],
            binCollection = {},
            result = [],
            ks;

        if(keys.indexOf("$by") < 0) return result;

        for(i = 0; i < l; i++){
            if(spec.$by instanceof Array) {
                ks = [];
                spec.$by.forEach(function(si){
                    ks.push(array[i][si]);
                });
                bin = JSON.stringify(ks);
            } else {
                bin = array[i][spec.$by];
            }
            if( bins.indexOf(bin) < 0 ){
                bins.push(bin);
                binCollection[bin] = [array[i]];
            } else {
                binCollection[bin].push(array[i]);
            }
        }

        var bl = bins.length;

        for(i = 0; i < bl; i++){
            var res = {};
            if(spec.$by instanceof Array) {
                ks = JSON.parse(bins[i]);
                spec.$by.forEach(function(s, j){
                    res[s] = ks[j];
                })

            } else {
                res[spec.$by] = bins[i];
            }

            keys.forEach(function(key){

                if(key != "$by") {
                    var opt = spec[key];
                    if(typeof opt === "function") {
                        res[key] = binCollection[bins[i]].map(function(a){ return a[key]; }).reduce(opt);
                    } else if(typeof opt === "string") {
                        if(opt === "$addToSet") {
                            res[key] = ArrayOpts.unique(binCollection[bins[i]].map(function(a){ return a[key]; }));
                        } else if (opt === "$addToArray") {
                            res[key] = binCollection[bins[i]].map(function(a){ return a[key]; });
                        } else if (opt === "$count") {
                            res[key] = binCollection[bins[i]].length;
                        } else {
                            var fname = opt.slice(1);
                            if(fname in ArrayOpts) {
                                res[key] = ArrayOpts[fname].call(null, binCollection[bins[i]].map(function(a){
                                    return a[key];
                                }));
                            }
                        }
                    }
                }
            });
            result.push(res);
        }

        return result;
    };

    query.sort = function(c, s) {
        return c.sort(function(a, b){
            var r = false;
            Object.keys(s).reverse().forEach(function(k){
                if(a[k] !== b[k]) {
                    r = (s[k]>0) ? (a[k] > b[k]) : (a[k] < b[k]);
                    return r;
                }
            });
            return r;
        })

    };

    query.orderBy = function(c, s, o) {
        var spec = {};
        s.forEach(function(ss){
            spec[ss] = o;
        });
        return query.sort(c, spec);
    };

    query.twoPassSort = function(c, s) {
        var sorted = c;
        Object.keys(s).reverse().forEach(function(k){
            sorted = sorted.sort(function(a, b){
                return ((s[k]) ? (a[k] > b[k]) : (a[k] < b[k]));
            });
        })
        return sorted;
    };

    query.histogram = function(data, spec, max, min) {
        var result = {};
        for(var key in spec) {
            result[key] = ArrayOpts.histogram(data.map(function(d){return d[key]}), spec[key], max, min);
        }
        return result;
    };

    query.normalize = function(data, fields) {
        var hash = {};

        fields.forEach(function(f){
            var array = data.map(function(d){ return d[f]; });
            hash[f] = ArrayOpts.normalize(array);
        });

        data.forEach(function(d, i){
            fields.forEach(function(f){
                d[f] = hash[f][i];
            });
        })

        return data;
    }

    return query;
}());

},{"../core/arrays.js":1}],8:[function(require,module,exports){
var opt = require("../core/arrays.js");

module.exports = function Stats(data, fields){

    if(!Array.isArray(data))
        throw new Error("Inproper input data format.");

    var result = {};

    fields.forEach(function(f) {

        var a = data.map(function(d){return d[f]; });
        result[f] = {
            min: opt.min(a),
            max: opt.max(a),
            avg: opt.avg(a),
            std: opt.std(a)
        };
    });

    return result;

};

},{"../core/arrays.js":1}],9:[function(require,module,exports){
module.exports = function Transform(data, spec){

    if(!Array.isArray(data))
        throw new Error("Inproper input data format.");

    var result = [],
        tranfs = {};

    Object.keys(spec).forEach(function(s){
        if(typeof(spec[s]) == "function") {
            tranfs[s] = spec[s];
        } else {
            //tranfs[s] = function(d) { return d[spec[s]]; };
            tranfs[s] = Function("$", "return " + spec[s] + ";");
        }

    });

    result = data.map(function(d){
        var item = {};
        Object.keys(spec).forEach(function(s){
            item[s] = tranfs[s].call(this, d);
        });
        return item;
    });

    return result;

};

},{}],10:[function(require,module,exports){
(function (global){
var root = typeof self == 'object' && self.self === self && self ||
           typeof global == 'object' && global.global === global && global ||
           this;

root.p4 = {
    arrays          : require("./core/arrays"),
    pipeline        : require("./core/pipeline"),
    datastruct      : require('./core/datastruct'),

    query           : require("./dataopt/query"),
    transform       : require('./dataopt/transform'),
    stats           : require('./dataopt/stats'),

    ctypes: {
        ctypes      : require("./ctypes/ctypes"),
        cstore      : require("./ctypes/cstore"),
        query       : require('./ctypes/query'),
    },

    io: {
        ajax        : require("./io/ajax"),
        csv         : require("./io/csv"),
        printformat : require("./io/printformat")
    },
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./core/arrays":1,"./core/datastruct":2,"./core/pipeline":3,"./ctypes/cstore":4,"./ctypes/ctypes":5,"./ctypes/query":6,"./dataopt/query":7,"./dataopt/stats":8,"./dataopt/transform":9,"./io/ajax":11,"./io/csv":12,"./io/printformat":13}],11:[function(require,module,exports){
module.exports = (function Ajax() {
    "use strict;"
    var ajax = {};

    ajax.request = function(arg) {
        var url = arg.url || arg,
            method = arg.method || "GET",
            dataType = arg.dataType || "json",
            data = arg.data || [],
            query = [];  //arraybuffer, blob, document, json, text

        for (var key in data) {
            query.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
        }

        return new Promise(function(resolve, reject) {

            var req = new XMLHttpRequest();
            req.open(method, url);
            req.responseType = dataType;

            req.onload = function() {
              if (req.status == 200) {
                resolve(req.response);
              }
              else {
                reject(Error(req.statusText));
              }
            };

            req.onerror = function() {
              reject(Error("Network Error"));
            };

            if (method == 'POST') {
                req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
            }

            req.send(data);
        });
    };

    ajax.get = ajax.request;

    ajax.post = function(arg) {
        arg.method = "POST";
        return ajax.request(arg);
    };

    return ajax;
})();

},{}],12:[function(require,module,exports){
var fs = require('fs');

module.exports = (function CSV(){
    "use strict;"
    var csv = {};

    csv.read = function(option){
        var filepath = option.filepath,
            bufferSize = option.bufferSize || option.chunkSize || 8 * 1024,
            textEncoding = option.textEncoding || 'utf-8',
            delimiter = option.delimiter || ",",
            onopen = option.onopen || function() {},
            onload = option.onload || function() {},
            oncomplete = option.oncomplete || function() {};

        function createReadStream() {
            return fs.createReadStream(filepath, {
              flags: 'r',
              fd: null,
              mode: 0666,
              encoding: textEncoding,
              bufferSize: bufferSize
            });
        }

        function getLineCount(callback) {
            var stream = createReadStream(),
                lineCount = 0;

            stream.on('data', function(data){
                for(var i=0, l=data.length; i<l; i++)
                    if(data.charCodeAt(i) === 10) lineCount++;
            });

            stream.on('error', function(){
                throw Error("Error during reading file.");
            });

            stream.on('end', function(){
                callback(lineCount);
            });
        }

        function loadCSV(delimiter, onChunk, onComplete) {
            var stream = createReadStream(),
                leftOver = "";

            stream.on('data', function(data){
                var loaded = 0,
                    rows = [];

                data = leftOver + data;   //prepend leftover from previous chunk
                rows = data.split('\n');

                leftOver = rows.pop();   //get leftover from current chunk (if any)
                rows = rows.map(function(r){
                    return r.split(delimiter);
                });
                onChunk(rows);
            });

            stream.on('error', function(){
                throw Error("Error during reading file.");
            });

            stream.on('end', function(){
                onComplete();
            });
        }

        function loadCSV_quote(delimiter, onChunk, onComplete) {
            var stream = createReadStream(),
                delimiterCode = delimiter.charCodeAt(0);
                leftOver = "";

            stream.on('data', function(data){
                var loaded = 0,
                    rows = [];

                data = leftOver + data;
                for(var i=0, l=data.length; i<l; i++){
                    if(data.charCodeAt(i) === 10) { // on each new line
                        rows.push(loadLine(data.slice(loaded,i+1), delimiterCode, loaded));
                        loaded = i+1;
                    }
                }
                if(loaded < data.length)
                    leftOver = data.slice(loaded-1, data.length);

                onChunk(rows);

            });

            stream.on('error', function(){
                throw Error("Error during reading file.");
            });

            stream.on('end', function(){
                onComplete();
            });
        }

        function loadLine(text, delimiterCode, initPos) {
            var L = text.length,
                EOL = false,
                QUOTE = false,
                fields = [],
                f = initPos, // start pos of current field
                c = initPos, //current pos
                code,        //code at c
                q;           //start pos of quote

            while(!EOL){
                code = text.charCodeAt(c);
                if(code === 10 || c>=L){
                    EOL = true;
                    // if(text.charCodeAt(c+1) === 13) ++c;
                    fields.push( text.slice(f, c) );
                } else {
                    if(code === delimiterCode && !QUOTE) {
                        var field = text.slice(f, c);
                        fields.push( field );
                        f = c+1;
                    } else if(code === 34){
                        if(QUOTE){
                            if(text.charCodeAt(c+1) === delimiterCode){
                                QUOTE = false;
                                fields.push(text.slice(q, c));
                                f = c+2;
                                c++;
                            }
                        } else {
                            q = c+1;
                            QUOTE = true;
                        }
                    }
                }
                c++;
            }
            return fields;
        }

        return getLineCount(function(numRow){
            onopen(numRow);
            loadCSV(delimiter, onload, oncomplete);
        });
    }

    return csv;
})();

},{"fs":14}],13:[function(require,module,exports){
var seq = require('../core/arrays.js').seq;

module.exports = function printformat(spec) {
    "user strict;"
    return function(value){
        if(typeof value !== "number") return value;
        var ret,
            convert,
            numericSymbols = ['y', 'z', 'a', 'f', 'p', 'n', 'µ', 'm', '', 'k', 'M','G', 'T', 'P', 'E', 'Z', 'Y'],
            n = seq(-24,24,3),
            i = numericSymbols.length-1,
            parts,
            precision = spec.match(/\d+/)[0] || 3,
            number = Number(value),
            exp,
            suffix;

        if(spec[spec.length-1] == 's')
            precision--;

        parts = number.toExponential(precision).toString().match(/^(-{0,1})(\d+)\.?(\d*)[eE]([+-]?\d+)$/);
        exp = parseInt(parts[4]) || 0;

        while (i--) {
            if (exp >= n[i]) {
                if(i==7 && (exp-n[i]) > 1) {
                    // console.log(exp-n[i]);
                    suffix = numericSymbols[i+1];
                    exp -= n[i+1];
                    break
                } else {
                    suffix = numericSymbols[i];
                    exp -= n[i];
                    break;
                }
            }
        }
        ret = parseFloat(parts[1] + parts[2] + '.' + (parts[3]||0) + 'e' + exp.toString());
        return ret.toString() + suffix;
    }
}

function stringToNumber(s){
    var symbols = ['y', 'z', 'a', 'f', 'p', 'n', 'µ', 'm', '', 'k', 'M','G', 'T', 'P', 'E', 'Z', 'Y'],
        exp = seq(-24,24,3);

    return parseFloat(s) * Math.pow(10, exp(symbols.indexOf(s[s.length-1])) );
}

},{"../core/arrays.js":1}],14:[function(require,module,exports){

},{}]},{},[10]);
