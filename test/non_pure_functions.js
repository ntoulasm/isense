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

// let global = {};
// let glob = 5;

// function zalada() {
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

// zalada();
// global;

// if(true) {
// 	x = 5;
// 	glob = 2;
// 	global.z = 5;
// } else if(false) {
// 	global.z = 2;
// 	glob = 12
// 	x = 10;
// } else {
// 	global.aaa = 5;
// 	glob = 15;
// 	x = 15;
// };

// global.a = 100;
// glob;

// {
// 	glob = 10000000;
// }
