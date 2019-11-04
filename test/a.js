import defaultExport1 from "a";
import * as namedImports1 from "b";
import {export1} from "";
import {export2, export3} from "";
import {a as export4} from "";
import defaultExport2, {export5} from "";
import defaultExport3, * as namedImports2 from "";

function x() {
	var a = 1, b = 2;
	{
		var b = 2;
	}
	function z() {
		var c = function() {};
		{var z;}
	}
	var d = 4;
	const e = 5;
}
x = 2;
x = "hello world";
x = true;
x = undefined;
x = null;
x = {};

{	
	var jaja = 2;
	let a = 1;
	x = 2;
};
x

function y(a, {z: b, c, d},  [e, f, ...g],  {h, i, j, k: {l, m}}) {
	let n = 2;
	// global = 5;
}
y();
y = x;
y(); // y is now a number

const [a, b, ...rest] = [1, 2, 3, 4, 5];
let {aa, bb, ...rrest} = {
    aa: 2,
    bb: 3,
    cc: 4,
    dd: 5,
    ee: 6
};

var obj = { a: 'foo' };
var { a: whereToStoreValue } = obj;

class point {

	constructor(x, y) {
		this.setX(x);
		this.setY(y);
	}
	
	set x(x) {
		this.x = x; 
	}

	get x() {
		return this.x;
	}

	set y(y) {
		this.y = y;
	}

	get y() {
		return this.y;
	}

	computeMagnitude() {
		return Math.sqrt(this.x * this.x + this.y * this.y);
	}

}
const p = new point();
p;

for(let i = 0; i < 5; ++i) {
	console.log(i);
}

(x = 5) + x + (x = "") + x;;

function foo() {}
foo();
foo = function() {
	x = "inside foo";
	let k = 2;
	let z = () => { k = "inside z" };
	z();
	k;
};
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
	x = 100;
})();
x;

hoisted();
x;
function hoisted() {
	x = 50;
}

function dog(breed, age) {
	this.breed = breed;
	this.age = age;
}
const cat = dog;
const goodBoy1 = new dog('Beagle', 1);
const goodBoy2 = new cat('Beagle', 2);