/*
let x, e;
if (e) { x = 4; } 
else { x = 'hello'; }
*/
let x = 2;
let y = 10;

if(true) {

  x = 2;
  x = 5;
  y = 5;

} else if (true) {

  x = 10;
  y = 12;

} else if (true) {

  x = 50;
  
} else if(true) {
  x = 2;
} else if(false) {
  y = "";
} else y = {a: 2};
y;
x;  // 2 || 5 || 10 || 50 || 2


