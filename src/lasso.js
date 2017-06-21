import {event, mouse} from 'd3-selection';
import {drag} from 'd3-drag';
import classifyPoint from 'robust-point-in-polygon';
import {dispatch} from 'd3-dispatch';
import {line, curveBasis} from 'd3-shape';

export default function() {

	var items =[],
		closePathDistance = 75,
		closePathSelect = true,
		isPathClosed = false,
		hoverSelect = true,
		targetArea,
		listeners = dispatch('start', 'draw', 'end'),
		g,
		dyn_path,
		close_path,
		origin_node,
		p0,
		// tpath,// The transformed lasso path for rendering
		origin,  // The lasso origin for calculations
		torigin,// The transformed lasso origin for rendering
		drawnCoords,// Store off coordinates drawn
		lassodrag = drag()// Apply drag behaviors
			.on('start.lasso',dragstart)
			.on('drag.lasso',dragmove)
			.on('end.lasso',dragend);

	var lassoLine = line()
    .curve(curveBasis);
    // Function to execute on call
	function lasso(selection) {

    // add a new group for the lasso
		g = selection.append('g')
            .attr('class','lasso');

    // add the drawn path for the lasso
		dyn_path = g.append('path')
            .attr('class','drawn')
						.style('fill-opacity', 0.05)
						.style('stroke', '#616161')
						.style('stroke-width', '2px');

    // add a closed path
		close_path = g.append('path')
            .attr('class','loop_close')
						.style('fill', 'none')
						.style('stroke', '#616161')
						.style('stroke-width', '2px')
						.style('stroke-dasharray', '3,3');

    // add an origin node
		origin_node = g.append('circle')
            .attr('class','origin')
						.style('fill', '#616161');

    // Call drag
		targetArea.call(lassodrag);
	}
	function dragstart() {
		p0 = [mouse(this)[0], mouse(this)[1]];
		// Init coordinates
		drawnCoords = [p0, p0];

		// Initialize paths
		// tpath = '';

		dyn_path.attr('d', null).datum(drawnCoords);
		close_path.attr('d', null).datum(drawnCoords);

		// Set every item to have a false selection and reset their center point and counters
		let pBox = this.getBoundingClientRect();
		items.nodes().forEach(function(e) {
			e.__lasso.possible = false;
			e.__lasso.selected = false;
			e.__lasso.hoverSelect = false;
			e.__lasso.loopSelect = false;

			var box = e.getBoundingClientRect();
			e.__lasso.lassoPoint = [Math.round(box.left-pBox.left + box.width/2),
				Math.round(box.top-pBox.top + box.height/2)];
		});

					// if hover is on, add hover function
		if(hoverSelect) {
			items.on('pointerover.lasso',function() {
				if (!lassodrag.filter().apply(this, arguments)) return;
				// if hovered, change lasso selection attribute to true
				this.__lasso.hoverSelect = true;
			});
		}
		// Draw origin node
		origin = [event.x, event.y];
		torigin = [p0[0], p0[1]];

		origin_node.attr('cx', p0[0])
			.attr('cy', p0[1])
			.attr('r',5)
			.attr('display',null);
		// Run user defined start function
		listeners.call('start', lasso, [items]);
	}

	function dragmove() {
		// Get mouse position within body, used for calculations
		var x = event.x,
			y = event.y;

		// Get mouse position within drawing area, used for rendering
		var tx = mouse(this)[0];
		var ty = mouse(this)[1];

		var dx = tx-p0[0];
		var dy = ty-p0[1];

		if (dx * dx + dy * dy > 100) {
			p0 = [tx,ty];
			drawnCoords.push(p0);
		}
		else drawnCoords[drawnCoords.length - 1] = [tx,ty];

		// Initialize the path or add the latest point to it
		// if (tpath==='') {
		// 	tpath = tpath + 'M ' + tx + ' ' + ty;
		// 	origin = [x,y];
		// 	torigin = [tx,ty];
		//
		// 	// Draw origin node
		// 	origin_node.attr('cx',tx)
		// 		.attr('cy',ty)
		// 		.attr('r',5)
		// 		.attr('display',null);
		// }
		// else {
		// 	tpath = tpath + ' L ' + tx + ' ' + ty;
		// }

		// drawnCoords.push([x,y]);

					// Calculate the current distance from the lasso origin
		var distance = Math.sqrt(Math.pow(x-origin[0],2)+Math.pow(y-origin[1],2));

					// Set the closed path line
		var close_draw_path = 'M ' + tx + ' ' + ty + ' L ' + torigin[0] + ' ' + torigin[1];

					// Draw the lines
		dyn_path.attr('d',lassoLine);//tpath);

		close_path.attr('d',close_draw_path);

					// Check if the path is closed
		isPathClosed = distance<=closePathDistance ? true : false;

					// If within the closed path distance parameter, show the closed path. otherwise, hide it
		if(isPathClosed && closePathSelect) {
			close_path.attr('display',null);
		}
		else {
			close_path.attr('display','none');
		}

		items.nodes().forEach(function(n) {
			n.__lasso.loopSelect = (isPathClosed && closePathSelect) ? (classifyPoint(drawnCoords,n.__lasso.lassoPoint) < 1) : false;
			n.__lasso.possible = n.__lasso.hoverSelect || n.__lasso.loopSelect;
		});

		listeners.call('draw', lasso, [items, lasso.possibleItems(), lasso.notPossibleItems()]);
	}

	function dragend() {
					// Remove pointerover tagging function
		items.on('pointerover.lasso',null);

		items.nodes().forEach(function(n) {
			n.__lasso.selected = n.__lasso.possible;
			n.__lasso.possible = false;
		});

					// Clear lasso
		dyn_path.attr('d',null);
		close_path.attr('d',null);
		origin_node.attr('display','none');

					// Run user defined end function
		listeners.call('end', lasso, [items, lasso.selectedItems(), lasso.notSelectedItems()]);
	}

  // Set or get list of items for lasso to select
	lasso.items  = function(_) {
		if (!arguments.length) return items;
		items = _;
		var nodes = items.nodes();
		nodes.forEach(function(n) {
			n.__lasso = {
				'possible': false,
				'selected': false
			};
		});
		return lasso;
	};

    // Return possible items
	lasso.possibleItems = function() {
		return items.filter(function() {
			return this.__lasso.possible;
		});
	};

    // Return selected items
	lasso.selectedItems = function() {
		return items.filter(function() {
			return this.__lasso.selected;
		});
	};

    // Return not possible items
	lasso.notPossibleItems = function() {
		return items.filter(function() {
			return !this.__lasso.possible;
		});
	};

    // Return not selected items
	lasso.notSelectedItems = function() {
		return items.filter(function() {
			return !this.__lasso.selected;
		});
	};

    // Distance required before path auto closes loop
	lasso.closePathDistance  = function(_) {
		if (!arguments.length) return closePathDistance;
		closePathDistance = _;
		return lasso;
	};

    // Option to loop select or not
	lasso.closePathSelect = function(_) {
		if (!arguments.length) return closePathSelect;
		closePathSelect = _===true ? true : false;
		return lasso;
	};

    // Not sure what this is for
	lasso.isPathClosed = function(_) {
		if (!arguments.length) return isPathClosed;
		isPathClosed = _===true ? true : false;
		return lasso;
	};

    // Option to select on hover or not
	lasso.hoverSelect = function(_) {
		if (!arguments.length) return hoverSelect;
		hoverSelect = _===true ? true : false;
		return lasso;
	};

    // Events
	lasso.on = function() {
		var value = listeners.on.apply(listeners, arguments);
		return value === listeners ? lasso : value;
	};

    // Area where lasso can be triggered from
	lasso.targetArea = function(_) {
		if(!arguments.length) return targetArea;
		targetArea = _;
		return lasso;
	};

	lasso.filter = function(_) {
		return arguments.length ?
			(lassodrag.filter(_), lasso) :
			lassodrag.filter();
	};


	return lasso;
}
