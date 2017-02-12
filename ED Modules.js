
////////////////////
////////// Inspired by EDEngineer         https://github.com/msarilar/EDEngineer
////////// ED Modules by Rob Kodey        https://github.com/rkodey
////////// DISCLAIMER!!   This script is super-rough, quick-and-dirty.  No judgement allowed!  :)

////////// Usage:  Double-click the JS file"
////////// Usage:  cscript.exe "ED Modules.js"


////////////////////
////////////////////
////////// Condifugation Stuff

var SHIP_FILTER = 0
// var SHIP_FILTER = /Anaconda|Asp|Cutter/i;

////////////////////
////////////////////



var FSO         = new ActiveXObject("Scripting.FileSystemObject");
var OUT         = FSO.CreateTextFile("Ships.html", true);
  
var WSHSHELL    = WScript.CreateObject("WScript.Shell");
var GAMES       = WSHSHELL.RegRead("HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders\\{4C5C32FF-BB9D-43B0-B5B4-2D72E54EAAA4}");
var ENV         = WSHSHELL.Environment("PROCESS");
var APPDATA     = ENV("APPDATA");
var MATERIALS   = {};
var SHIPS       = {};
var ALLSLOTS    = {};
var MODMAP      = {};
var STORAGE     = [];
var CURSHIP     = '';

var RANGE       = 'FSD Range';
ALLSLOTS[RANGE] = 1;

var CMDLINE     = 1;
if(WScript.FullName.match(/wscript\.exe/i)) {
  WScript.echo("To see some additional output, run this script at the command line, using cscript.exe.");
  CMDLINE       = 0;
}


////////////////////
////////// Data lookup / conversions / replacements
var SIZES = {
  size0     : '0'
 ,size1     : '1'
 ,size2     : '2'
 ,size3     : '3'
 ,size4     : '4'
 ,size5     : '5'
 ,size6     : '6'
 ,size7     : '7'
 ,size8     : '8'
 ,size9     : '9'

 ,turret    : 'T'
 ,gimbal    : 'G'
 ,fixed     : 'F'

 ,tiny      : ' '
 ,elite     : ' '
 ,ranger    : ' '
 ,tycoon    : ' '
 ,stellarbodydiscoveryscanner : '0'
 ,detailedsurfacescanner      : '0'
};

var CLASSES = {
  class1    : 'E'
 ,class2    : 'D'
 ,class3    : 'C'
 ,class4    : 'B'
 ,class5    : 'A'

 ,tiny      : '0'
 ,small     : '1'
 ,medium    : '2'
 ,large     : '3'
 ,huge      : '4'

 ,standard  : 'Std '
 ,advanced  : 'Adv '
 ,'name;'   : ' '
};

var SLOT_FROM_MOD = {
  Thrusters     : 'Engines'
}

var TYPES = {
  'Corrosion Resistant Cargo Rack'  : 'Anti-Corrosive Cargo'
 ,'Planetary Vehicle Hangar'        : 'SRV Hangar'
 ,'HighFrequency'                   : 'Charge Enh'
 ,'LightWeight'                     : 'Lightweight'
 ,'HeatSinkLauncher'                : 'Heat Sink'
 ,'PointDefence'                    : 'Point Defence'
 ,'LongRange'                       : 'Long Range'
 ,'Tuned'                           : 'Clean Tuning'
 ,'Boosted'                         : 'Overcharged'
                // .replace('HighFrequency',    'Charge')
}

var reRemoveSort  = /^[yz] /;   // Used to remove the goofy sorting



////////////////////
////////// Functions that "standardize" certain data values
function getType(type) {
  return TYPES[type] || type || '';
}

function getShipName(name, id) {
  if(!name) return '';
  name  = name.toLowerCase();
  name  = name.replace('empire_trader',        'Clipper');
  name  = name.replace('federation_corvette',  'Corvette');
  return name.charAt(0).toUpperCase() + name.slice(1) + (id ? ' '+id : '');
}

function getSlotFromEnh(oEnh, ship) {
  // Some Enhancements reference Modules that exist in a names Slot, like Engines.  Other Enhancemnts apply to Shields which may be elsewhere.
  var slot      = SLOT_FROM_MOD[oEnh.Mod] || oEnh.Mod;

  if(ship[slot]) return slot  // If we get a direct match, we're good
  else {                      // Otherwise, loop through the slots to see if there's a module in the numbered slots
    var aSlots  = getSortedKeys(ship);
    while(slot = aSlots.shift()) {
      if(ship[slot].Type == oEnh.Mod) return slot;
    }
  }
}

function getItemDetails(src) {
  src = (src||'').replace('dronecontrol_collection',  'dronecontrolcollection');  // They put in an extra underscore for drones!  Ugh.
  var aParts    = src.split('_');
  var obj       = { Type:aParts[1], Size:aParts[2], Class:aParts[3] };
  return obj;
}

function getSlotAndSize(src) {
  var aParts  = src ? src.split('_') : ['',''];
  var slot    = aParts[0];

  // Use a bunch of replace statements becuase some have numbers
  // Also forces some goofy sorting by adding prefix characters
  slot        = slot
                .replace('Decal',            'z Decal ')
                .replace('PaintJob',         'z PaintJob ')
                .replace('HugeHardpoint',    'y HP Huge ')
                .replace('LargeHardpoint',   'y HP Large ')
                .replace('MediumHardpoint',  'y HP Medium ')
                .replace('TinyHardpoint',    'y HP Tiny ')
                .replace('FrameShiftDrive',  'FSD')
                .replace('Engine',           'Thrusters')
                .replace('MainThrusterss',   'Engines') // sic
                .replace('PowerDistributor', 'Power Distributor')
                .replace('PowerPlant',       'Power Plant')
                .replace('ShieldGenerator',  'Shield Generator')
                .replace('ShieldBooster',    'Shield Booster')
  aParts[0]   = slot;
  var obj     = { Slot:aParts[0], Size:aParts[1] };
  return obj;
}

function getEnh(enh) {
  var obj     = getSlotAndSize(enh);
  enh         = obj.Slot;
  obj.Slot    = TYPES[enh] || enh;
  obj         = { Mod : obj.Slot, Enh : TYPES[obj.Size] || obj.Size };
  // dump(obj, enh);
  return obj;
}

function getModClassSizeEnh(obj) {
  var ModClass  = CLASSES[obj.ModClass] || obj.ModClass || '';
  var ModSize   = SIZES[obj.ModSize]    || obj.ModSize  || '';
  var enh       = (obj.Enh ? ' '+(obj.Enh||'')+' '+(obj.EnhLevel?'G'+obj.EnhLevel:'') : '');
  return ModClass + ModSize + enh;
}

function checkSlotModType(slot, modtype) {
  if(slot) {  // Ignore selling an empty slot
    if(slot.ModType == modtype) {
      return true;
    }
    else {
      print('mismatch');
      WScript.Quit();
    }
  }
}

function getSortedKeys(obj) {
  var k = [];
  for(var i in obj) {
    k.push(i);
  }
  return(k.sort());
}



////////////////////
////////// Output Functions

function print(str) {
  if(CMDLINE) WScript.echo(str);
}

function writeSlot(label, slot, oShip, file) {
  // Central output of slot details.  Writes to "file" if specified, otherwise to the screen

  var tdclass   = 'module'
  if(label == CURSHIP) {
    tdclass     = 'module current-td';
  }

  var obj = oShip[slot];
  if(obj) {
    var size      = SIZES[obj.Size] || '';
    var Type      = getType(obj.Type);
    var enhclass  = ''
    if(obj.Enh) {
      enhclass    = 'enhance';
    }

    if(file)  file.WriteLine('<td class="'+tdclass+'"><span class="'+enhclass+'">' + getModClassSizeEnh(obj) + '</span><br>' + Type +'<br></td>');
    else      print(
                '    '+(label+'        ').substr(0,8) + ' : ' + slot.replace(reRemoveSort, '') + ' ' + size
                                                      + ' : ' + getModClassSizeEnh(obj) + ' : ' + Type
              );
  }
  else {
    if(file && label != 'Storage') file.WriteLine('<td class="'+tdclass+'"></td>');
  }
}

function writeShips() {
  // Main HTML output
  // First, write the header row, of all ship names, plus "Storage" at the end
  var headers = getSortedKeys(SHIPS);
  var head;
  OUT.WriteLine('<tr><th></th>');
  while(head  = headers.shift()) {
    if(getSortedKeys(SHIPS[head]).length && (!SHIP_FILTER || head.match(SHIP_FILTER))) {
      OUT.WriteLine('<th class="'+(head==CURSHIP?'current-th':'')+'">'+head+'</th>');
    }
  }
  OUT.WriteLine('<th style="border:0;">&nbsp;</th><th class="current-th">Storage</th></tr>');

  // Then, loop through ALLSLOTS - which is a dynamic/cumulative list of all the slot names your ships carry.  These will be the rows in the HTML.
  var nStore  = 0;
  var slots   = getSortedKeys(ALLSLOTS);
  var slot;
  while(slot  = slots.shift()) {  // For each slot, write a row
    OUT.WriteLine('<tr><th><br>'+slot.replace(reRemoveSort, '')+'<br></th>');

    // Now, this is inefficient, because we are transposing the data.  For each row, we need to loop through each ship
    var ships = getSortedKeys(SHIPS);
    var ship;
    while(ship = ships.shift()) {
      if(getSortedKeys(SHIPS[ship]).length && (!SHIP_FILTER || ship.match(SHIP_FILTER))) {
        writeSlot(ship, slot, SHIPS[ship], OUT);
      }
    }

    // Now, write the pseudo-ship called Storage
    // NOTE: Storage is simply an Array.  It does not track slot names like ships do.  So, we simply use a counter.
    OUT.WriteLine('<td style="border:0;"></td>');
    writeSlot('Storage', nStore++, STORAGE, OUT);
    OUT.WriteLine("</tr>");
  }
}

function dump(obj, label) { // For debugging
  label = label || 'dump';
  var keys = getSortedKeys(obj);
  var key;
  print('        dump ' + label + ' ' + keys.length + ' keys');
  while(keys && keys.length) {
    key = keys.shift();
    print('        dump ' + label + ' ' + key + ':' + obj[key]);
  }
}



////////////////////
////////// Mechanical functions that manage Storage, Modules, etc.
function fixModType(obj) {
  // Mass module storage doesn't include Localised names.  Ugh.  So, let's keep a map of known names as we encounter them.
  if(obj) {
    if(obj.ModType && obj.Type) {
      MODMAP[obj.ModType] = obj.Type;
    }
    else if(obj.ModType && !obj.Type) {
      obj.Type  = MODMAP[obj.ModType] || '';
    }
  }
  return obj;
}

function moveFromStorage(newmod) {
  for(var stor in STORAGE) {  // look for the module in storage
    var stored  = fixModType(STORAGE[stor]);
    // This looks for the first closest match, because there's no way I can see it identify individual Storage slots
    if(stored.Type == newmod.Type && stored.ModSize == newmod.ModSize && stored.ModClass == newmod.ModClass) {
      STORAGE.splice(stor, 1);
      return stored;
    }
  }
  return newmod;
}

function getNewModule(obj, item, slot) {
  var oItem   = getItemDetails(obj[item]);
  var oSlot   = getSlotAndSize(obj[slot||'Slot']);
  return fixModType({
    Slot      : oSlot.Slot,
    Size      : oSlot.Size || '',
    Type      : obj[item+'_Localised'] || '',
    ModType   : oItem.Type,
    ModSize   : oItem.Size,
    ModClass  : oItem.Class,
    Enh       : getEnh(obj.EngineerModifications).Enh
  });
}

function moveToStorage(ship, obj, name, label) {
  var newmod  = getNewModule(obj, name);  // Create our starting Module, like above

  // Since the Journal might Store a Module that we've never seen, save the starting Module into the Ship since the basic info is all there
  ship[newmod.Slot] = ship[newmod.Slot] || newmod;

  // Then, we can safely store the Module from the Ship.
  if(checkSlotModType(ship[newmod.Slot], newmod.ModType)) {
    STORAGE.push(ship[newmod.Slot]);
    writeSlot(label, newmod.Slot, ship);
    delete ship[newmod.Slot];
  }
}

function getObj(line, flag) {
  var obj = eval('('+line+')');
  if(flag || line.match(/xxhighfrequencyxx/i)) dump(obj, obj.event);  // debugging
  return obj;
}



////////////////////
// MaterialCollected
// MaterialDiscarded
// Screenshot
// EngineerApply
// EngineerCraft
// ModuleBuy
// ModuleRetrieve
// ModuleSell
// ModuleStore
// ModuleSwap
// ShipyardBuy
// ShipyardNew
// ShipyardSell
// ShipyardTransfer
// ShipyardSwap
function readFile(file) {
  // print(file);
  f = FSO.OpenTextFile(file);
  while (!f.AtEndOfStream) {
    var line      = f.ReadLine();
    var ship      = SHIPS[CURSHIP] = (SHIPS[CURSHIP] || {});

    // Sell a ship
    if(line.match(/"event":"(ShipyardSell)/i)) {
      var obj     = getObj(line, 0);
      var oldship = getShipName(obj.ShipType, obj.SellShipID);
      delete SHIPS[oldship];
    }

    else  // Handle new ships.  Both purchased ships, and swapping of ships.
    if(line.match(/"event":"(Shipyard)/i)) {
      var obj     = getObj(line, 0);

      // Here, we handle the case where the Journal starts logging Module events before we know which ship.
      // So, backfill the "empty" ship once we know it.
      var oldship = getShipName(obj.StoreOldShip, obj.StoreShipID);
      if(!CURSHIP && oldship) {
        SHIPS[oldship] = SHIPS[''];
        // SHIPS[oldship].Ship = oldship;
        delete SHIPS[''];
      }

      // We have a new ship!
      CURSHIP     = getShipName(obj.ShipType, obj.NewShipID || obj.ShipID || '');
      print('New Ship: ' + CURSHIP + (oldship ? ', Old Ship: '+oldship : ''));
    }

    else  // New enhamcenents that are actually Applied
    if(line.match(/"event":"EngineerApply"/i)) {
      var obj           = getObj(line, 0);
      var oEnh          = getEnh(obj.Blueprint)
      var slot          = getSlotFromEnh(oEnh, ship);   // Go find a Slot that contains the Module we're enhancing
      if(slot) {  // We found a Slot with an appropriate Module.  So, add the Enhancement!
        var oSlot       = ship[slot];
        oSlot.Enh       = oEnh.Enh;
        oSlot.EnhLevel  = obj.Level;
        writeSlot('Enhanced', slot, ship);
      }
      else {      // Didn't find a Slot / Module.  Must be Enhancing a Module that was present before the Journal started.  SKIP.
        writeSlot('Missing', slot, ship);
      }
    }

    else  // For debugging - dump Engineer events not matched above (for future support of new events)
    if(line.match(/"event":"(Engineer)/i)) {
      // var obj = getObj(line, 1);
    }

    else  // Bought a new module
    if(line.match(/"event":"ModuleBuy"/i)) {
      var obj     = getObj(line, 0);
      var newmod  = getNewModule(obj, 'BuyItem');
      ship[newmod.Slot]     = newmod;
      ALLSLOTS[newmod.Slot] = 1;
      writeSlot('Bought', newmod.Slot, ship);
    }

    else  // Retrieved a module from storage.
    if(line.match(/"event":"ModuleRetrieve"/i)) {
      var obj     = getObj(line, 0);
      var newmod  = getNewModule(obj, 'RetrievedItem');   // This call creates a new Module object out of the "RetrievedItem"
      var stormod = moveFromStorage(newmod);              // Go check and see if the module is in Storage.
                                                          // If not, then the Journal missed it.  This call will return newmod if not in Storage.
                                                          // This call also removes the Module from Storage.

      if(obj.SwapOutItem) { // First step: Check to see if we're Storing the existing Module
        var swapmod = getNewModule(obj, 'SwapOutItem');
        var oldmod  = fixModType(ship[newmod.Slot]);
        if(checkSlotModType(oldmod, swapmod.ModType)) {
          STORAGE.push(oldmod);
          writeSlot('Stored', newmod.Slot, ship);
        }
      }

      // Now, we can safely overwrite the Slot with the Module we got from Storage (or the one we created if Storage doesn't have it)
      ship[newmod.Slot]     = stormod;                    // Save the Module we got out of Storage
      ALLSLOTS[newmod.Slot] = 1;
      writeSlot('Retrieve', slot, ship);
    }

    else  // Sell a Module out of Storage
    if(line.match(/"event":"ModuleSellRemote"/i)) {
      var obj     = getObj(line, 0);
      var newmod  = getNewModule(obj, 'SellItem');    // Create our starting Module, like above
      var stormod = moveFromStorage(newmod);          // Then, check Storage and REMOVE the Module if there.  Done!
      print('    S-Remote :  : '+getModClassSizeEnh(stormod)+' : '+stormod.Type);
    }

    else  // Sell a Module
    if(line.match(/"event":"ModuleSell"/i)) {
      var obj     = getObj(line, 0);
      var newmod  = getNewModule(obj, 'SellItem');    // Create our starting Module, like above
      var slot    = getSlotAndSize(obj.Slot).Slot;    // Go right to the specified Slot, check to make sure it's a match to the event, and Remove it.
      if(checkSlotModType(ship[slot], newmod.ModType)) {
        writeSlot('Sold', slot, ship);
        delete ship[slot];
      }
    }

    else  // Move multiple  Modules to Storage
    if(line.match(/"event":"MassModuleStore"/i)) {
      var obj       = getObj(line, 0);
      for(var i=0; i < obj.Items.length; i++) {
        moveToStorage(ship, obj.Items[i], 'Name', 'M-Stored');
      }
      // WScript.Quit();
    }

    else  // Move a Module to Storage
    if(line.match(/"event":"ModuleStore"/i)) {
      var obj     = getObj(line, 0);
      moveToStorage(ship, obj, 'StoredItem', 'Stored');
    }

    else  // Swap the Modules in 2 Slots
    if(line.match(/"event":"ModuleSwap"/i)) {
      var obj     = getObj(line, 0);
      var frmod   = getNewModule(obj, 'FromItem', 'FromSlot');  // Create a "from" Module
      var tomod   = getNewModule(obj, 'ToItem',   'ToSlot');    // Create a "to" Module
      print('    Swap     : ' + frmod.Slot.replace(reRemoveSort, '') + '  : ' + ((ship[frmod.Slot]||{}).Type||'')
                             + ' : ' + tomod.Slot.replace(reRemoveSort, '') + '  : ' + ((ship[tomod.Slot]||{}).Type||'') );

      // Swap them!
      var swap          = ship[tomod.Slot] || tomod;
      ship[tomod.Slot]  = ship[frmod.Slot] || frmod;
      ship[frmod.Slot]  = swap;
    }

    else  // For debugging - dump Module events not matched above (for future support of new events)
    if(line.match(/"event":"(Module)/i)) {
      // var obj = getObj(line, 1);
    }

    else
    if(line.match(/"event":"(FSDJump)/i)) {
      // var obj   = getObj(line, 0);
      // if(ship[RANGE]) {
        // if(obj.JumpDist > ship[RANGE].Enh) ship[RANGE].Enh = obj.JumpDist;
      // }
      // else {
        // ship[RANGE] = {
          // Slot      : 'Jump'
         // ,Size      : ''
         // ,Type      : 'Estimate'
         // ,Enh       : obj.JumpDist
        // };
      // }

    }

    // else
    // if(line.match(/"event":"ManualUserChange"/i)) {
      // var obj = getObj(line);
      // MATERIALS[obj.Type] = (MATERIALS[obj.Type]||0) + obj.Count;
    // }
  }
  f.Close();
}


////////////////////
////////////////////
////////// Main

OUT.WriteLine('\
<html>\n\
<head>\n\
<title>ED Ships</title>\n\
<style>\n\
  body        { background:#0F0800; color:#c06400; }\n\
  table       { border-collapse:collapse; top:1px; margin:40px auto; }\n\
  td,th       { border:1px solid #c06400; padding:2px 5px; white-space:nowrap; font-size:14px; }\n\
  th          { color:#aaa; }\n\
  .freeze     { position:fixed; left:5px; width:150px; margin-top:-1px; }\n\
  .current-td { background:#2C1700; }\n\
  .current-th { background:#c06400; color:black; }\n\
  .enhance    { color:#00bbff; }\n\
  .module     {  }\n\
  #focus      { margin-left:158px; overflow-x:scroll; }\n\
</style>\n\
</head>\n\
<body>\n\
<table cellpadding="0" cellspacing="0" border="0" tabindex="0">\n\
');


// readFile(APPDATA+'\\EDEngineer\\manualChanges.xxx.json');
var folder = FSO.GetFolder(GAMES+'\\Frontier Developments\\Elite Dangerous');
for (var fc = new Enumerator(folder.files); !fc.atEnd(); fc.moveNext()) {
  var file = fc.item();
  if(file.Name.match(/Journal.*log/i)) {
    readFile(file.Path);
  }
}

writeShips();

OUT.WriteLine('\
</table>\n\
</body>\n\
</html>\n\
');
OUT.Close();

WScript.echo("\nDone.\nWrote: Ships.html\n");
