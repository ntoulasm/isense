let z = 7;
let w = {};
function f1 ()   { z = []; }
function f2(a)   { a.x = 10; }
function f3(a,b) { a.y = b; z='foo'; }
f1();
f2(w);
f3(w, 'bar');
  z; 
//^hover
  w;
//^hover

let x = 5;
  x;
//^hover
//^def
function foo() {}
foo();
  x;
//^hover

foo = function() {
	x = "inside foo";
	let k = 2;
	let z = () => { k = "inside z" };
	z();
	k;
};;
foo();
  x;
//^hover

x = 10;
x;
foo();
  x;
//^hover

foo = () => { x = "inside foo arrow"; };
foo();
  x;
//^hover

(function () {
	  x;
//  ^hover
	x = 100;
})();

  x;
//^hover

hoisted();
x;

function hoisted() {
	  x;
//  ^hover
	x = 50;
}

let global = {};
let glob = 5;


// function foo() {
// 	if(true) {
// 		if(2) {
// 			return;
// 		}
// 		global.x = 5;
// 	} else {
// 		global.y = 2;
// 	}
// 	global.z = 5;
// 	return 10;
// }

// foo();
// global;
