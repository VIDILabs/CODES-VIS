if(typeof(define) == "function") define(function(){return slider;})

function slider(arg){

	this.container = arg.container; //This is a string, the id to the div creadted to store the svg
	this.width = arg.width;
	this.height = arg.height;
	this.bins = arg.bins || [1.0, 0.7, 0.3, 0];

	this.rectWidth = this.width * 0.2; //This is the width of the rectangle, it will take up 20% of the svg width

	this.callback = arg.callback; //This is the callback function, it will call when any of the diamond is finish being drag

	var self = this;

	//define the functions that will be call when the diamonds are being drag
    this.dragmove1 = function(d){

        var x = d3.event.x;
        var y = d3.event.y;

        // console.log(y);

        d3.select(this).attr("transform", "translate(" + (self.rectWidth + 5 ) + "," + y + ")");


        self.topRectH = y;
        self.midRectH = self.height - self.topRectH - self.botRectH;
        self.midRectS = y;

        self.topRect.attr('height', y);

        self.midRect.attr('height', self.midRectH).attr('y', y);
        self.percentage1.attr('y', self.midRectS + 5).text(function(){ return ((1 - self.midRectS / self.height) * 100).toFixed(1) + "%";  });

    }

    this.dragmove2 = function(d){
        var x = d3.event.x;
        var y = d3.event.y;

        // console.log(y);

        d3.select(this).attr("transform", "translate(" + (self.rectWidth + 5 ) + "," + y + ")");

        self.midRectH = y - self.topRectH;
        self.midRectE = y - self.topRectH;

        self.botRectH = self.height - self.topRectH - self.midRectH;
        self.botRectS = y;

        self.midRect.attr('height', self.midRectH);

        self.botRect.attr('height', self.botRectH).attr('y', self.botRectS);
        self.percentage2.attr('y', self.botRectS + 5).text(function(){ return ((1 - self.botRectS / self.height) * 100).toFixed(1) + "%";  });
    }

	//initialize the drag behavior for the diamond
	this.drag1 = d3.behavior.drag()
                    .on("drag", this.dragmove1)
                    .on("dragend", this.callback);

    this.drag2 = d3.behavior.drag()
                .on("drag", this.dragmove2)
                .on("dragend", this.callback);

    //create the svg
    this.svg = d3.select("#" + this.container).append('svg').attr('width', this.width).attr('height', this.height).append('g');

    //creat the height and the starting location of the 3 rects
    this.topRectH = this.height * (1-this.bins[1]);
    this.midRectH = this.height * (this.bins[1] - this.bins[2]);
    this.botRectH = this.height * (this.bins[2]);


    this.midRectS = this.height * (1-this.bins[1]);
    this.botRectS = this.height * (1-this.bins[2]);

    //create the three rects
    this.topRect = this.svg.append('rect').attr('x', 0).attr('y', 0).attr('width', this.rectWidth).attr('height', this.topRectH)
    					.attr('fill', 'hsl(0,100%,50%)').attr('opacity', 1);

    this.midRect = this.svg.append('rect').attr('x', 0).attr('y', this.midRectS).attr('width', this.rectWidth)
						.attr('height', this.midRectH).attr('fill', 'hsl(40,100%,50%)').attr('opacity', 1);

    this.botRect = this.svg.append('rect').attr('x', 0).attr('y', this.botRectS).attr('width', this.rectWidth)
						.attr('height', this.midRectH).attr('fill', 'hsl(120,100%,60%)').attr('opacity', 1);


    //creata the two diamonds
    this.selector1 = this.svg.append('path').attr("d", d3.svg.symbol().type("diamond"))
                                .attr("transform", function() {

                                        return "translate(" + (self.rectWidth + 5 ) + "," + self.midRectS + ")";
                                    }
                                )
                                .call(self.drag1);

    this.selector1 = this.svg.append('path').attr("d", d3.svg.symbol().type("diamond"))
                                .attr("transform", function() {

                                        return "translate(" + (self.rectWidth + 5 ) + "," + self.botRectS + ")";
                                    }
                                )
                                .call(this.drag2);


    //create the 2 percentage lable
    this.percentage1 = this.svg.append('text').attr('x', this.rectWidth + 10).attr('y', this.midRectS + 5)
                            .text(function(){return ((1 - self.midRectS / self.height) * 100).toFixed(1) + "%";});

    this.percentage2 = this.svg.append('text').attr('x', this.rectWidth + 10).attr('y', this.botRectS + 5)
                            .text(function(){return ((1 - self.botRectS / self.height) * 100).toFixed(1) + "%";});




    //this function retrive the three percentage
    this.getPercentage = function(){

    	return [1.0, (1 - self.midRectS / self.height), (1 - self.botRectS / self.height), 0.0];
    }


}
