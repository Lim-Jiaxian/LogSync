// Sample data mirroring the database schema. Replace with API calls.
export const SEED={
 stations:[{id:1,division:3,name:'Sengkang Fire Station'},{id:2,division:3,name:'Punggol Fire Station'}],
 users:[
  {user_id:101,station_id:1,username:'Haikel (FF)',role:'FF',rota:1},
  {user_id:102,station_id:1,username:'Johnson (SC)',role:'SC',rota:2},
  {user_id:103,station_id:1,username:'Rahman (IC)',role:'IC',rota:3},
  {user_id:201,station_id:2,username:'Wong (FF)',role:'FF',rota:1}],
 appliances:[{callsign:'PL331',station_id:1,type:'PL'},{callsign:'LF3311E',station_id:1,type:'LF'},{callsign:'FMV331E',station_id:2,type:'FB'}],
 equipment:[
  {equipment_id:1,serial_number:'BA-0041',name:'BA set',station_id:1,appliance:'PL331',status:'ON_APPLIANCE',notes:''},
  {equipment_id:2,serial_number:'BA-0042',name:'BA set',station_id:1,appliance:'PL331',status:'ON_APPLIANCE',notes:''},
  {equipment_id:3,serial_number:'TIC-007',name:'Thermal imaging camera',station_id:1,appliance:'PL331',status:'ON_APPLIANCE',notes:''},
  {equipment_id:4,serial_number:'HR-210',name:'Hydraulic rescue tool',station_id:1,appliance:'LF3311E',status:'ON_APPLIANCE',notes:''},
  {equipment_id:5,serial_number:'CS-018',name:'Chainsaw',station_id:1,appliance:null,status:'STORE',notes:'Spare'},
  {equipment_id:6,serial_number:null,name:'Salvage sheet',station_id:1,appliance:null,status:'STORE',notes:''},
  {equipment_id:7,serial_number:'BA-0990',name:'BA set',station_id:2,appliance:'FMV331E',status:'ON_APPLIANCE',notes:''}],
 checklist:[
  {id:1,appliance:'PL331',label:'BA set',what_to_check:'Gauge above 270 bar, mask sealed',expected_qty:2},
  {id:2,appliance:'PL331',label:'Thermal imaging camera',what_to_check:'Battery charged, powers on',expected_qty:1},
  {id:3,appliance:'LF331E',label:'Hydraulic rescue tool',what_to_check:'Hoses intact, no leaks',expected_qty:1},
  {id:4,appliance:'FMV331E',label:'BA set',what_to_check:'Gauge above 270 bar',expected_qty:1}],
 log:[],hoto:[],results:[],service:[]
};
