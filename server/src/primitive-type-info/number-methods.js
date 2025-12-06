const TypeInfo = require('../utility/type-info');

module.exports = [
	{
		name: 'constructor',
		parameters: [],
		returns: TypeInfo.Type.Number,
	},
	{
		name: 'toExponential',
		returns: TypeInfo.Type.Number,
	},
	{
		name: 'toFixed',
		returns: TypeInfo.Type.Number,
	},
	{
		name: 'toLocaleString',
	},
	{
		name: 'toPrecision',
		returns: TypeInfo.Type.Number,
	},
	{
		name: 'toString',
		returns: TypeInfo.Type.String,
	},
	{
		name: 'valueOf',
	},
	{
		name: 'hasOwnProperty',
	},
	{
		name: 'isPrototypeOf',
	},
	{
		name: 'propertyIsEnumerable',
	},
];
