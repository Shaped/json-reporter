/*	@shaped/nodejs/reporters/json (C) 2023 Shaped.ca (forbiddenera)		*
 *	json output reporter for node:test 									*/
import { Transform } from 'stream';
export default class jsonReporter extends Transform {
	constructor() { super({ writableObjectMode: true });
					this.currentNode = null;
					this.depth = 0; this.lastIndex = 0;
					this.depthMap = new Map();
					this.suiteData = []; this.root = []; }
	add(data) { this.currentNode = this.root;
				for (let i = 0; i < data.depth; i++)
					this.currentNode = this.currentNode[this.currentNode.length - 1].children;

				this.lastIndex = this.currentNode.push({ ...data, children: [] });
				this.depthMap.set(data.depth, this.currentNode[this.lastIndex - 1]); }
	merge(data) { Object.assign(this.depthMap.get(data.depth),data); }
	_transform(event, encoding, callback) {
		let pass = 0, fail = 0, skip = 0, err = 0, dis = 0, buf  = ``;
		event.data.depth = event.data.nesting; delete event.data.nesting;
		if (event.data?.testNumber) event.data.testNumber = parseInt(event.data.testNumber);
		if (event.data?.details?.duration_ms) {
			event.data.duration_ms = event.data.details.duration_ms;
			event.data.duration = parseFloat(Number(event.data.details.duration_ms / 1000).toFixed(6));
			delete event.data.details.duration_ms;
		}

		if (event.data?.details && Object.keys(event.data.details).length === 0) delete event.data.details;
		switch(true) {
			case (event.data?.skip !== undefined): event.data.state = "skipped";	break;
			case (event.data?.todo !== undefined): event.data.state = "todo";		break;
			default: event.data.state = `${event.type.replace(`test:`,``)}ed`;		}

		switch (event.type) {
			case 'test:start':
				this.suiteData.push({ depth: event.data.depth, pass: 0, fail: 0, skip: 0, todo: 0, errors: 0, disabled: 0 });
				this.add(event.data);
				callback(null, ``); break;
			case 'test:pass':
			case 'test:fail':
				if (event.data?.details?.error) {
					event.data.error				= JSON.parse(JSON.stringify(event.data.details.error));	// These values are not copyable: [stack], cause.[stack] cause.[message] cause.[name], [message]
					event.data.error.stack			= event.data.details.error.stack;
					event.data.error.message		= event.data.details.error.message.replaceAll("\n"," ").trim();
					event.data.error.cause.stack 	= event.data.details.error.cause.stack;
					event.data.error.cause.message 	= event.data.details.error.cause.message.replaceAll("\n"," ").trim();
					event.data.error.cause.name 	= event.data.details.error.cause.name;
					delete event.data.details.error;

					if (event.data?.details?.name) { event.data.error.errorName = event.data?.details?.name;
													 delete event.data?.details?.name; }
				}

				(event.data?.details && Object.keys(event.data.details).length === 0) ? delete event.data.details:null;
				for (let x=this.suiteData.length-1;x >= 0;x--)
					if (event.data.depth > this.suiteData[x].depth)
						switch(event.data.state) {
							case "skipped"	: this.suiteData[x].skip++; 	break;
							case "todo"		: this.suiteData[x].todo++; 	break;
							case "error"	: this.suiteData[x].errors++; 	break;
							case "disabled"	: this.suiteData[x].disabled++; break;
							case "failed"	: this.suiteData[x].fail++; 	break;
							default			: this.suiteData[x].pass++;		}

				if (event.data.depth == this.suiteData[this.suiteData.length-1].depth)
					switch(event.data.state) {
						case "skipped"		: this.suiteData[this.suiteData.length-1].skip++; 		break;
						case "todo"			: this.suiteData[this.suiteData.length-1].todo++; 		break;
						case "error"		: this.suiteData[this.suiteData.length-1].errors++; 	break;
						case "disabled"		: this.suiteData[this.suiteData.length-1].disabled++; 	break;
						case "failed"		: this.suiteData[this.suiteData.length-1].fail++; 		break;
						default				: this.suiteData[this.suiteData.length-1].pass++;		}

				for (let x=0;x <=this.suiteData.length-1;x++)
					if (event.data.depth == this.suiteData[x].depth) {
						pass = this.suiteData[x].pass;		fail = this.suiteData[x].fail;
						skip = this.suiteData[x].skip;		err  = this.suiteData[x].errors;
						dis  = this.suiteData[x].disabled;	}

				Object.assign(event.data, {pass,fail,skip,err,dis});
				this.merge(event.data);

				callback(null, ``); break;
			case 'test:diagnostic': buf = (event.data.message.startsWith(`duration_ms`)) ? JSON.stringify(this.root,null,4):buf;
			case 'test:plan': case 'test:coverage': default: callback(null, buf);
		}
	}
};