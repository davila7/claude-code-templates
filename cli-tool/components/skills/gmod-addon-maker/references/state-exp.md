<title>States / Realms</title>

Lua states, also known as realms in Garry's Mod, are separate instances of the Lua language that can only interact and communicate with one another through indirect means such as the `net` and `file` libraries. As they are separate Lua states, global variables in one state cannot be retrieved in another without using indirect communication methods.

States load their custom functions and callbacks through Lua files included by the engine. All other files except those explicitly listed under each state below must be <page text="included">Global.include</page> from Lua to be used.

There are 3 Lua states in Garry's Mod:

# Client
<upload src="19952/8d7b58bc25e14dd.png" size="342" name="image.png" />
The **client** state is the Lua state representing the game client. It takes player input and sends it to the server while receiving data about other entities and players, then uses all of this information for <page>Prediction</page>. The client simulates entities in sync with the server's tickrate, but will perform <page text="rendering">Render Order</page> every frame.

The **client** state can interact and communicate with **server** state via the <page>net</page> library and <page text="running serverside concommands">Global.RunConsoleCommand</page>.

Lua code can detect if it is running in the **client** state by checking if the `CLIENT` global is `true`.


**Engine Lua Files - Client**
* `lua/includes/init.lua`
* `lua/derma/init.lua`
* `lua/gamemodes/base/gamemode/cl_init.lua` (this is always loaded regardless of the set gamemode)
* `lua/autorun/*.lua`
* `lua/autorun/client/*.lua`
* `lua/postprocess/*.lua`
* `lua/vgui/*.lua`
* `lua/matproxy/*.lua`
* `lua/skins/default.lua`
* `lua/gamemodes/<gamemode_name>/gamemode/cl_init.lua`
* `lua/gamemodes/base/entities/entities/*.lua`
* `lua/gamemodes/base/entities/entities/*/cl_init.lua`
* `lua/gamemodes/base/entities/weapons/*.lua`
* `lua/gamemodes/base/entities/weapons/*/cl_init.lua`
* `lua/entities/*.lua`
* `lua/entities/*/cl_init.lua`
* `lua/weapons/*.lua`
* `lua/weapons/*/cl_init.lua`
* `lua/gamemodes/<gamemode_name>/entities/entities/*.lua`
* `lua/gamemodes/<gamemode_name>/entities/entities/*/cl_init.lua`
* `lua/gamemodes/<gamemode_name>/entities/weapons/*.lua`
* `lua/gamemodes/<gamemode_name>/entities/weapons/*/cl_init.lua`

# Server
<upload src="19952/8d7b58d7428c9c6.png" size="337" name="image.png" />
The **server** state is the Lua state representing the game server. It can either be on the same system as the game client through a Listen Server, or on a separate system as a Dedicated Server. It takes input from players, performs physics and entity simulation at a static tickrate, then networks the result to all connected players.

The **server** state can interact and communicate with the **client** state via the <page>net</page> library (and formerly via the <page>umsg</page> library).

Lua code can detect if it is running in the **server** state by checking if the `SERVER` global is `true`.


**Engine Lua Files - Server**
* `lua/includes/init.lua`
* `lua/gamemodes/base/gamemode/init.lua` (this is always loaded regardless of the set gamemode)
* `lua/autorun/*.lua`
* `lua/autorun/server/*.lua`
* `lua/gamemodes/<gamemode_name>/gamemode/init.lua`
* `lua/gamemodes/base/entities/entities/*.lua`
* `lua/gamemodes/base/entities/entities/*/init.lua`
* `lua/gamemodes/base/entities/weapons/*.lua`
* `lua/gamemodes/base/entities/weapons/*/init.lua`
* `lua/entities/*.lua`
* `lua/entities/*/init.lua`
* `lua/weapons/*.lua`
* `lua/weapons/*/init.lua`
* `lua/gamemodes/<gamemode_name>/entities/entities/*.lua`
* `lua/gamemodes/<gamemode_name>/entities/entities/*/init.lua`
* `lua/gamemodes/<gamemode_name>/entities/weapons/*.lua`
* `lua/gamemodes/<gamemode_name>/entities/weapons/*/init.lua`

# Menu
<upload src="19952/8d7b58bce4f33d1.png" size="343" name="image.png" />
The **menu** state is an isolated internal Lua state on the game client, used solely for the main menu. It has extra functions missing from the **client** state. Menu modifications and addons are not officially supported, thus running **menu** state code requires overriding one of the engine's Lua files. For this reason, you won't need to worry about making your code work on the **menu**, unless you're deliberately overwriting something.

The **menu** state cannot interact with the **client** or **server** states; that is, the **menu** state cannot run any function that will make a callback occur on the **client** or **server**. The **client** and **menu** states can indirectly communicate with each other through the <page>file</page> library as they always share a common filesystem.

Lua code can detect if it is running in the **menu** state by checking if the `MENU_DLL` global is `true`.


**Engine Lua Files**
* `lua/includes/init_menu.lua`
* `lua/derma/init.lua`
* `lua/menu/menu.lua`
* `lua/vgui/*.lua`

# Other

These are not actual states; rather, they signify that the function or hook they represent can be executed in either one of their specified states:

- Shared (Client and Server)
<upload src="19952/8d7b58d999caa0e.png" size="487" name="image.png" />
- Client and Menu
<upload src="19952/8d7b58a905836e9.png" size="506" name="image.png" />
- Shared and Menu (all states - Client, Server and Menu)
<upload src="19952/8d7b58e58180414.png" size="552" name="image.png" />

These don't necessarily mean the function/hook will return the same values in the different states, or that it does the same thing. For example, the function <page>Entity:GetPos</page> can be called on either Server or Client, so it is considered "shared." <page>undo.GetTable</page> is also a shared function, but it works differently on Client and Server, as explained in its description. On the other hand, libraries like <page>math</page> and <page>string</page> have identical functionality in all 3 states.

# "Shared" isn't a state

It's important to remember that the **Server** and **Client** states (known colloquially as "Shared") are completely separate at runtime, and they cannot coexist. Meaning, something like this:

```lua
if SERVER and CLIENT then   -- always false...
end
```

makes no sense, because the condition `SERVER and CLIENT` will always return `false` due to both states' mutual exclusivity. Only one of the two can be true at any given point.

So, don't be fooled by the "Shared state"; it's not really a state at all. "Shared" does not mean that `CLIENT` and `SERVER` will both be `true` at the same time - it's just a shorthand way to communicate that a piece of code can be run on *either* the Server or Client at any point, but not both "at once."