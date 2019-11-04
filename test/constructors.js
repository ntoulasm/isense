const Person = (firstName, lastName, age) => {

  this.firstName = firstName;
  this.lastName = lastName;
  this.age = age;

  this.getFullName = () => this.firstname + this.lastName;

};
let person = new Person();

function dog(breed, age) {
	this.breed = breed;
	this.age = age;
}
const cat = dog;
const goodBoy1 = new dog('Beagle', 1);
const goodBoy2 = new cat('Beagle', 2);

class x {
  a = 2;
  b;
  getA() {
    return a;
  }
}

let a = new x();