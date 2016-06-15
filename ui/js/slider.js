if(typeof(define) == "function") define(function(){return slider;})

function slider(arg){

	this.container = arg.container; //This is a string, the id to the div creadted to store the svg
	this.width = arg.width;
	this.height = arg.height;
	this.bins = arg.bins || [1.0, 0.7, 0.3, 0];

	this.rectWidth = this.width * 0.2; //This is the width of the rectangle, it will take up 20% of the svg width

	this.callback = arg.callback; //This is the callback function, it will call when any of the diamond is finish being drag

	this.padding = arg.padding || {top: 5, bottom: 10};

	var self = this;

	this.svgHeight = this.height - this.padding.top - this.padding.bottom;

	//define the functions that will be call when the diamonds are being drag
    this.dragmove1 = function(d){
		// if()
        var x = d3.event.x;
        var y1 = d3.event.y;

		var y = y1 - self.padding.top;


		if(y > self.padding.top - 1 && y < self.botSelectPos)
		{
			// console.log(y);
			// console.log(y1);
	        self.topRectH = y - self.padding.top;
	        self.midRectH = self.svgHeight - self.topRectH - self.botRectH;
	        self.midRectS = y;

			d3.select(this).attr("transform", "translate(" + (self.rectWidth + 3 ) + "," + y + ")");
			// d3.select(this).attr("transform", "translate(" + ( 0 ) + "," + y + ")");

			self.topSelectPos = y;

	        self.topRect.attr('height', self.topRectH);

	        self.midRect.attr('height', self.midRectH).attr('y', y );
	        self.percentage1.attr('y', self.midRectS + 5).text(function(){ return ((1 - self.topRectH / self.svgHeight) * 100).toFixed(1) + "%";  });
			// self.percentage1.attr('y', self.midRectS + 5).text(function(){ return ((1 - (self.midRectS - self.padding.top) / self.svgHeight) * 100).toFixed(1) + "%";  });
		}

    }

    this.dragmove2 = function(d){
        var x = d3.event.x;
        var y1 = d3.event.y;

		var y = y1 - self.padding.top;

		if( y < (self.svgHeight + self.padding.top)  && y > self.topSelectPos)
		{
	        d3.select(this).attr("transform", "translate(" + (self.rectWidth + 3 ) + "," + y + ")");
			self.botSelectPos = y;

	        self.midRectH = y - self.topRectH - self.padding.top;
	        self.midRectE = y - self.topRectH - self.padding.top;

	        self.botRectH = self.svgHeight - self.topRectH - self.midRectH;
	        self.botRectS = y;

	        self.midRect.attr('height', self.midRectH);

	        self.botRect.attr('height', self.botRectH).attr('y', self.botRectS);
	        // self.percentage2.attr('y', self.botRectS + 5).text(function(){ return ((1 - self.botRectS / self.svgHeight) * 100).toFixed(1) + "%";  });
			self.percentage2.attr('y', self.botRectS + 5).text(function(){ return ((self.botRectH / self.svgHeight) * 100).toFixed(1) + "%";  });
		}
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
    this.topRectH = this.svgHeight * (1-this.bins[1]);
    this.midRectH = this.svgHeight * (this.bins[1] - this.bins[2]);
    this.botRectH = this.svgHeight * (this.bins[2]);

	console.log(this.topRectH, this.midRectH, this.botRectH, this.svgHeight)


    this.midRectS = this.svgHeight * (1-this.bins[1]);
    this.botRectS = this.svgHeight * (1-this.bins[2]);

    //create the three rects
    this.topRect = this.svg.append('rect').attr('x', 0).attr('y', 0 + this.padding.top).attr('width', this.rectWidth).attr('height', this.topRectH)
    					.attr('fill', 'hsl(0,100%,50%)').attr('opacity', 1);

    this.midRect = this.svg.append('rect').attr('x', 0).attr('y', this.midRectS + this.padding.top).attr('width', this.rectWidth)
						.attr('height', this.midRectH).attr('fill', 'hsl(40,100%,50%)').attr('opacity', 1);

    this.botRect = this.svg.append('rect').attr('x', 0).attr('y', this.botRectS + this.padding.top).attr('width', this.rectWidth)
						.attr('height', this.botRectH).attr('fill', 'hsl(120,100%,60%)').attr('opacity', 1);


	var tri1 = [
		{ 'x': 0 , 'y': 0 },
		{ 'x': 5 , 'y': -5},
		{ 'x': 5 , 'y':5},
	];



	this.selector1 = this.svg//.append('g')
							 .append('polygon')
							 .attr('points', function(){
								 return tri1.map( function(d) { return [d.x,d.y].join(","); }).join(" ");
							 })
                             .attr("transform", function() {
                                     return "translate(" + (self.rectWidth + 3 ) + "," + (self.midRectS  + self.padding.top) + ")";
                                 }
							  )
							 .attr('stroke', 'black')
							 .attr('stroke-width', 2)
                                .call(self.drag1);


	this.selector2 = this.svg
							.append('polygon')
							.attr('points', function(){
								return tri1.map( function(d) { return [d.x,d.y].join(","); }).join(" ");
							})
							.attr("transform", function() {
									return "translate(" + (self.rectWidth + 3 ) + "," + (self.botRectS  + self.padding.top) + ")";
								}
							 )
							.attr('stroke', 'black')
							.attr('stroke-width', 2)
                                .call(this.drag2);
	this.topSelectPos = self.midRectS  + self.padding.top;
	this.botSelectPos = self.botRectS  + self.padding.top;


    //create the 2 percentage lable
    this.percentage1 = this.svg.append('text').attr('x', this.rectWidth + 10).attr('y', this.midRectS + 5 + this.padding.top)
                            .text(function(){return ((1 - self.midRectS / self.svgHeight) * 100).toFixed(1) + "%";});

    this.percentage2 = this.svg.append('text').attr('x', this.rectWidth + 10).attr('y', this.botRectS + 5 + this.padding.top)
                            .text(function(){return ((1 - self.botRectS / self.svgHeight) * 100).toFixed(1) + "%";});




    //this function retrive the three percentage
    this.getPercentage = function(){

    	// return [1.0, (1 - (self.midRectS ) / self.svgHeight), (1 - self.botRectS / self.svgHeight), 0.0];
		return [1.0, (1 - (self.topRectH ) / self.svgHeight), (self.botRectH / self.svgHeight), 0.0];
    }


}
