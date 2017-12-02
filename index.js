/* StromDAO Business Object: CLI Helper
 * =========================================
 * Helper Modules for CLI Tools
 * 
 * @author Thorsten Zoerner thorsten.zoerner@stromdao.com 
 * 
 * If used in StromDAO-BO's MAIN BRANCH this will be defaulted to the testnet environment.
 * 
 */
var srequest = require('sync-request');
var StromDAOBO = require("stromdao-businessobject");  
const fs = require('fs');
const vm = require('vm');

module.exports = function(vorpal) {
   var interactive = vorpal.parse(process.argv, {use: 'minimist'})._ === undefined;
   
   vorpal
  .command('webuser <meter_point_id>')
  .option('-u --username <user>', 'Username')    
  .option('-p --password <pass>', 'Password')
  .option('-b','Set Balance Group to Node')
  .option('--ui <ipfshash>','File to link as UI Profile')
  .option('--file <filename>', 'Optional Filename for Profile Storage')
  .description("Create a new webuser (or overwrite) with given credentials")    
  .action(function (args, callback) {	
	  ensure_balancing(args,callback,function() {		  
		var account_obj=new StromDAOBO.Account(args.options.username,args.options.password);
		var node = new StromDAOBO.Node({external_id:args.meter_point_id,testMode:true});
		node.roleLookup().then(function(rl) {
				rl.setRelation(41,global.smart_contract_stromkonto).then(function(x) {									
				account_obj.wallet().then(function(wallet) {
						account_obj.encrypt(node.wallet.privateKey).then(function(enc) {
							account_obj.encrypt(node.RSAPrivateKey).then(function(enc_rsa) {
								node.stringstoragefactory().then(function(ssf)  {						
									ssf.build(enc).then(function(ss) {
										ssf.build(enc_rsa).then(function(ss_rsa) {
											ssf.build(node.RSAPublicKey).then(function(ss_pub) {
											var node = new StromDAOBO.Node({external_id:args.options.username,privateKey:wallet.privateKey,testMode:true,rpc:global.rpcprovider});	
											node.roleLookup().then(function(rl) {
												rl.setRelation(224,ss_pub).then(function(tx) {
												rl.setRelation(223,ss_rsa).then(function(tx) {
														rl.setRelation(222,ss).then(function(tx) {
																	vorpal.log("Webuser created",tx);									
																	// Dump Profile
																	if(typeof args.options.file != "undefined") {
																				var storage = require("node-persist");
																				var fs = require("fs");
																				storage.initSync();
																				values=storage.keys();
																				var tmp = {};
																				
																				for (var k in values){
																					if (values.hasOwnProperty(k)) {			
																						if(values[k].substr(0,"address_".length)=="address_") {				
																							tmp[""+values[k].toLowerCase()]=storage.getItemSync(""+values[k]);																	
																						}
																						if(values[k].substr(0,"name_".length)=="name_") {				
																							tmp[""+values[k].toLowerCase()]=storage.getItemSync(""+values[k]);																	
																						}
																					}
																				}	
																				fs.writeFile(args.options.file, JSON.stringify(tmp), 'utf8', function() {
																					vorpal.log("Profile File written");
																					callback(); 
																					});	
																	} else 
																	if(typeof args.options.ui != "undefined") {								
																		//var ui_profile=fs.readFileSync(arg.options.ui);
																		account_obj.encrypt(args.options.ui).then(function(enc_profile) {
																				// IPFS Wrapper here
																				node.stringstoragefactory().then(function(ssf)  {						
																					ssf.build(enc_profile).then(function(ss) {
																						node.roleLookup().then(function(rl) {
																							rl.setRelation(11,ss).then(function(tx) {
																								vorpal.log("UI Profile set");
																								callback();
																							});
																						});
																					});
																				});
																		});
																		
																	} else {
																		callback();	
																	}
														});
													});
												});
											});
										});
										});
									});
								});							
							});
						});
					});	
				});	
			});		
		});				  			
	}); 
	
	vorpal
	  .command('backup <zipfilename>')    
	  .description("Exports local storage to zip file.") 
	  .action(function (args, callback) {	
		var zip = require('file-zip'); 
		zip.zipFolder(['./.node-persist'],args.zipfilename,function(err){
			if(err){
				vorpal.log('backup zip error',err)
			}else{
				vorpal.log('Backup saved to',args.zipfilename);
			}
			callback();
		});		
	});	
  
  function ensureNodeWallet() {	
		var p1 = new Promise(function(resolve, reject) {
			if(typeof process.env.privateKey !="undefined") {				
				var node = new StromDAOBO.Node({external_id:"stromdao-mp",rpc:global.rpcprovider,privateKey:process.env.privateKey,testMode:true,rpc:global.rpcprovider});	  
			} else {
				var node = new StromDAOBO.Node({external_id:"stromdao-mp",rpc:global.rpcprovider,testMode:true});	  
			}
				vorpal.log("Initializing node:",node.wallet.address);
				global.blk_address=node.wallet.address;
				node.roleLookup().then(function(rl) {
					rl.relations(node.wallet.address,42).then(function(tx) {
						if(tx=="0x0000000000000000000000000000000000000000") {
							node.stromkontoproxyfactory().then(function(skof) {
								skof.build().then(function(sko) {
									rl.setRelation(42,sko).then(function(sr) {														
										node.stromkontoproxy(sko).then(function(s) {
											s.modifySender(node.nodeWallet.address,true).then(function(tx) {
												resolve(sko);		
											});
										});																				
									});
								});
							}).catch(function(e) {vorpal.log("Consens failed connect Level 2",e);reject();});
						} else {
							resolve(tx);
						}				
					}).catch(function(e) {vorpal.log("Consens failed connect Level 1",e);reject();});
			}).catch(function(e) {vorpal.log("Consens failed init",e);reject();});		
		}); 
		return p1;
  }
   
  ensureNodeWallet().then(function(sko) {
	global.smart_contract_stromkonto=sko;
	vorpal.log("Balancing Contract:",global.smart_contract_stromkonto);										
	if (interactive) {
		vorpal
			.delimiter('stromdao $')
			.show();
	} else {
		// argv is mutated by the first call to parse.
		process.argv.unshift('');
		process.argv.unshift('');
		vorpal
			.delimiter('')
			.parse(process.argv);
	}
});
}

