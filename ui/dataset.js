define(function(){ return datasets; });

function datasets() {
    "use strict";
    var ds = {};

    ds.selectedDataID = 0;
    p4.io.ajax.get({
        url: "/datasets",
        dataType: "json"
    }).then(function(datasets){

        datasets.forEach(function(dataset, di){
            var row = $("<tr/>");
            var cells = [
                di,
                dataset.model.name,
                dataset.model.num_node,
                dataset.model.num_router,
                dataset.model.routing,
                dataset.workload.app + " " + dataset.workload.tasks
            ];
            cells.forEach(function(cell){
                row.append($("<td/>").text(cell))
            });

            row.click(function(){
                $("#datasets > table > tbody > tr").removeClass("info");
                row.addClass("info");
                ds.selectedDataID = di;
            });
            $("#datasets > table > tbody").append(row);
        })

        $("#datasets > table > tbody > tr").first().addClass("info");
    });

    return ds;
}
