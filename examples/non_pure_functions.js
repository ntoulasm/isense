let z = 7;
let w = {};
function f1 ()   { z = []; }
function f2(a)   { a.x = 10; }
function f3(a,b) { a.y = b; z='foo'; }
f1();
f2(w);
f3(w, 'bar');
z; w;

let x = 5;
x;
function foo() {}
foo();
x;

foo = function() {
	x = "inside foo";
	let k = 2;
	let z = () => { k = "inside z" };
	z();
	k;
};;
foo();
x;

x = 10;
x;
foo();
x;

foo = () => { x = "inside foo arrow"; };
foo();
x;

(function () {
	x;
	x = 100;
})();

x;

hoisted();
x;

function hoisted() {
	x;
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
