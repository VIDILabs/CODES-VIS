function Panel(arg) {
    "use strict;"
    var option = arg || {},
        width = option.width || 800,
        height = option.height || 360,
        header = option.header || false,
        headerHeight = option.headerHeight || 30,
        top = option.y || 0,
        left = option.x || 0,
        zIndex = option.z || 0,
        container = option.container || null;

    var panel = document.createElement("div");
    panel.className = "panel panel-default";
    panel.style.width = width + "px";

    if(header) {
        panel.header = document.createElement("div");
        panel.header.className = "panel-heading";
        panel.header.style.backgroundColor = "#FFFFFF";
        panel.header.style.height = headerHeight + "px";
        panel.appendChild(panel.header);
    }

    panel.body = document.createElement("div");
    panel.body.className = "panel-body";
    panel.body.style.width = width + "px";
    panel.body.style.height = height + "px";
    panel.body.style.position = "relative";
    panel.style.top = top + "px";
    panel.style.left = left + "px";
    panel.style.zIndex = zIndex;
    panel.appendChild(panel.body);


    Object.defineProperty(panel, "title", {
        set: function(title) {panel.header.innerHTML = "<strong>"+title+"</strong>";}
    });

    if(container) {
        container = (typeof(container) == "string") ? document.getElementById(container) : container;
        container.appendChild(panel);
        container.style.position = "relative";
    }

    panel.append = function(child) {
        panel.body.appendChild(child);
        return panel;
    }

    panel.update = function(objectArray) {
        panel.body.innerHTML = "";
        panel.body.appendChild(objectArray);
    }

    panel.clear = function(){
        panel.body.innerHTML = "";
    }

    return panel;
};


function DropDropMenu(arg) {
    "use strict;"
    var option = arg || {},
        options = option.options || [],
        selected = option.selected || 0,
        label = option.label || "",
        mode = option.mode || "default",
        size = option.size || "xs",
        float = option.pull || option.float || "left",
        onchange = option.onchange || function(){},
        container = option.container || null;

    var dropdown = document.createElement("div"),
        button = document.createElement("button"),
        ul = document.createElement("ul"),
        tag = document.createElement("span");

    // Object.defineProperty(dropdown, "value", {
    //     set: function(v){
    //         selected = options.indexOf(v);
    //         if(selected > -1){
    //             if(label != "") tag.innerHTML = label + ": ";
    //             button.innerHTML = options[selected] + '<span class="caret"></span>';
    //             if( v != dropdown.value) {
    //                 onchange(v);
    //             }
    //         }
    //     }
    // });

    Object.defineProperty(dropdown, "onchange", {
        set: function(f) {onchange = f; return dropdown;}
    });

    dropdown.className = "dropdown";
    button.className = "btn dropdown-toggle btn-" + mode + " btn-" + size;
    ul.className = "dropdown-menu";
    dropdown.style.zIndex = 101;
    dropdown.style.margin = "0 10px";
    ul.style.zIndex = 999;
    dropdown.style.float = float;


    button.setAttribute("type", "button");
    button.setAttribute("data-toggle", "dropdown");
    ul.setAttribute("role", "menu");

    function setOptions(options) {
        options.forEach(function(opt){
            var li = document.createElement("li"),
                a = document.createElement("a");

                a.setAttribute("href", "#");
                a.innerHTML = opt;
                a.onclick = function(){

                    var v = this.text;
                    selected = options.indexOf(v);
                    if(selected > -1){
                        if(label != "") tag.innerHTML = label + ": ";
                        button.innerHTML = options[selected] + '<span class="caret"></span>';
                        if( v != dropdown.value) {
                            dropdown.value = v;
                            onchange(v);
                        }
                    }
                };

                li.appendChild(a);
                ul.appendChild(li);
        });
        dropdown.value = options[selected];
        if(label != "") tag.innerHTML = label + ": ";
        button.innerHTML = options[selected] + '<span class="caret"></span>';
    }

    setOptions(options);


    dropdown.appendChild(tag);
    dropdown.appendChild(button);
    dropdown.appendChild(ul);

    dropdown.button = button;
    dropdown.val = function() {
        return dropdown.value;
    }

    dropdown.changeOptions = function(newOptions, sel) {
        ul.innerHTML = "";
        if(typeof(sel) != 'undefined') selected = 0;
        setOptions(newOptions);
    }

    if(container)
        container.appendChild(dropdown);

    return dropdown;
};
