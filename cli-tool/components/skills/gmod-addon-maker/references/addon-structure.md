# Lua Folder Structure
The main game directory for Garry's Mod is the `garrysmod` folder located next to the game's executable `hl2.exe`, and contains much of the content you see while playing the game.  This includes Lua scripts, sound effects, 3D models, and more.  Each Addon for Garry's Mod needs its own folder in `garrysmod/addons/` that will hold all of its content.

Addons and Gamemodes have a nearly identical folder structure to the `garrysmod` folder.  When making an Addon, all folders are optional and only those that your Addon requires should be created in order to keep your Addon's folder structure clean and easy to navigate.

Because this folder structure is applicable in multiple situations, the generic term `{Root}` is used here to mean the folder at the base of the game, Addon, or Gamemode.
Folders that are meant primarily for use by Garry's Mod internally are marked with `[I]` to mean "Internal" and should not be modified unless you have a good reason to be doing so.  Keep in mind that adding or modifying files outside of an Addon or Gamemode is discouraged because it can lead to file conflicts and unexpected behaviors.  With very few exceptions, any change or addition made to Garry's Mod should be done using an Addon or a Gamemode.

**Please note:** This is **not** an exhaustive list.  This list is primarily intended to give a general overview of the game's folder structure as it relates to lua scripts, with more detailed information where it is relevant for Gamemode and Addon creation.

` {Root} `  
`   ├── lua`  
`   │    ├── autorun` - Scripts in this folder are run automatically when Lua starts on both [Client](https://wiki.facepunch.com/gmod/States#client) and [Server](https://wiki.facepunch.com/gmod/States#server) (Called ["Shared"](https://wiki.facepunch.com/gmod/States#sharedisntastate)) realms.   
`   │    │    ├── client` - Runs its contents automatically in the [Client](https://wiki.facepunch.com/gmod/States#client) realm.  
`   │    │    ├── server` - Runs its contents automatically in the [Server](https://wiki.facepunch.com/gmod/States#server) realm.  
`   │    │    └── properties` - Holds the default <page text="Properties">properties</page> used in <page>The Context Menu</page>, which are loaded by `lua/autorun/properties.lua`  
`   │    ├── bin` - Where <page text="Binary Modules">Creating_Binary_Modules</page>, an advanced feature, should be placed.  
`   │    ├── derma` - Where <page>Derma</page> utility scripts should go.  
`   │    ├── drive` - A dedicated folder for scripts relating to the <page>Drive</page> system.   
`   │    ├── effects` - Where scripts for custom <page text="Lua-based Effects">util.Effect</page> go.  
`   │    ├── entities` - Scripts placed here will be loaded as <page text="Scripted Entities (SENTs)">Scripted_Entities</page>.  
`   │    ├── includes` - `[I]` This is where `init.lua` (The first lua file executed when lua starts) is located.  
`   │    ├── matproxy` - For scripts relating the <page text="Material Proxy (matprox)">matproxy</page> library, used to create per-entity materials.  
`   │    ├── menu` - `[I]` Similar to the `includes` directory but for the game's main menu.  Starts by running `menu.lua`.   
`   │    ├── postprocess` - Where scripts defining <page>Post-Processing Materials</page> are located.  
`   │    ├── skins` - Where scripts defining <page text="Skins">Derma_Skin_Creation</page> for the <page>Derma</page> library are placed.   
`   │    ├── vgui` - Scripts defining <page>Derma</page> interface elements like <page text="DButtons">DButton</page> and <page text="DSliders">DSlider</page>.  
`   │    └── weapons` - Scripts placed here will be loaded as <page text="Scripted Weapons (SWEPs)">Structures/SWEP</page>  
`   │         └── gmod_tool` - This folder is created by the Toolgun in the <page text="Sandbox">gamemodes/Sandbox</page> Gamemode.  
`   │             └── stools` - This is where lua files for <page text="Scripted Tools (STOOLs)">Structures/TOOL</page> used with the Toolgun are placed.   
`   └── gamemodes` - <page text="Gamemodes">Gamemode_Creation</page> can be thought of as Addons that are only active while they are being played.  
`        └── {Gamemode Name}` - Each Gamemode gets its own folder, which acts as its `{Root}` directory.  
`             └── gamemode` - This folder **must** exist and **must** contain at least `init.lua` and `cl_init.lua` for the Gamemode to work.