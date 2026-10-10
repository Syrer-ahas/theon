local Players=game:GetService("Players")
local RS=game:GetService("ReplicatedStorage")
local UIS=game:GetService("UserInputService")
local RunService=game:GetService("RunService")
local TweenService=game:GetService("TweenService")
local HttpService=game:GetService("HttpService")
local SoundService=game:GetService("SoundService")
pcall(function() game:GetService("StarterGui"):SetCoreGuiEnabled(Enum.CoreGuiType.Backpack,false) end)
local player=Players.LocalPlayer
local remotes=RS:WaitForChild("GameRemotes")
local action=remotes:WaitForChild("HudAction")
local titleCatalog=require(RS:WaitForChild("HussTitleCatalog"))
local movementConfig=require(RS:WaitForChild("HussR6AnimationPack"):WaitForChild("Player")).Config
local screen=script.Parent
local old=screen:FindFirstChild("ReferenceHUD") if old then old:Destroy() end
local referenceScreens
local root=Instance.new("Frame") root.Name="ReferenceHUD" root.Size=UDim2.fromScale(1,1) root.BackgroundTransparency=1 root.Parent=screen
local WHITE=Color3.fromRGB(240,241,236)
local GOLD=Color3.fromRGB(255,209,72)
local CYAN=Color3.fromRGB(116,219,255)
local function make(class,name,parent,props)
 local obj=Instance.new(class) obj.Name=name
 for k,v in pairs(props or {}) do obj[k]=v end obj.Parent=parent return obj
end
local function corner(obj,r) make("UICorner","Corner",obj,{CornerRadius=UDim.new(0,r or 8)}) end
local function stroke(obj,color,width) return make("UIStroke","Border",obj,{Color=color or Color3.fromRGB(4,8,9),Thickness=width or 2}) end
local function text(parent,name,value,size,pos,dims,color,weight)
 local obj=make("TextLabel",name,parent,{BackgroundTransparency=1,Text=value,TextSize=size,Position=pos,Size=dims,TextColor3=color or WHITE,FontFace=Font.new("rbxasset://fonts/families/Montserrat.json",weight or Enum.FontWeight.Bold)})
 stroke(obj,Color3.fromRGB(0,0,0),1) return obj
end
local function panel(parent,name,pos,size)
 local f=make("Frame",name,parent,{Position=pos,Size=size,BackgroundColor3=Color3.fromRGB(25,29,30),BackgroundTransparency=.18}) corner(f,10) stroke(f)
 local inner=make("Frame","Inset",f,{Position=UDim2.fromOffset(3,3),Size=UDim2.new(1,-6,1,-6),BackgroundTransparency=1}) corner(inner,7) stroke(inner,Color3.fromRGB(93,98,101),1)
 return f
end
local function button(parent,name,value,pos,size,color)
 local b=make("TextButton",name,parent,{Text="",Position=pos,Size=size,BackgroundColor3=Color3.fromRGB(31,33,35),BackgroundTransparency=.12,AutoButtonColor=false}) corner(b,8) stroke(b)
 local inset=make("Frame","Inset",b,{BackgroundTransparency=1,Position=UDim2.fromOffset(3,3),Size=UDim2.new(1,-6,1,-6)}) corner(inset,5) stroke(inset,Color3.fromRGB(103,106,113),1)
 local label=text(b,"Label",value,15,UDim2.fromOffset(10,0),UDim2.new(1,-20,1,0),color)
 b.MouseEnter:Connect(function() TweenService:Create(b,TweenInfo.new(.1),{BackgroundColor3=Color3.fromRGB(48,53,56)}):Play() end)
 b.MouseLeave:Connect(function() TweenService:Create(b,TweenInfo.new(.1),{BackgroundColor3=Color3.fromRGB(31,33,35)}):Play() end)
 return b,label
end
local function accent(parent,color)
 local a=make("Frame","Accent",parent,{Position=UDim2.new(0,12,1,-7),Size=UDim2.new(1,-24,0,3),BackgroundColor3=color,BorderSizePixel=0}) corner(a,2)
end
local function comma(n)
 local s=tostring(math.floor(n or 0)) local a=s:reverse():gsub("(%d%d%d)","%1,"):reverse() return a:gsub("^,","")
end
local scaleTargets={}
local function scaled(obj) local s=make("UIScale","ResponsiveScale",obj,{Scale=1}) table.insert(scaleTargets,s) end
local notice=text(root,"Notice","",15,UDim2.new(.5,-260,1,-180),UDim2.fromOffset(520,30),GOLD) notice.Visible=false
local noticeToken=0
local function notify(msg)
 noticeToken+=1 local token=noticeToken notice.Text=msg notice.Visible=true
 task.delay(3,function() if token==noticeToken then notice.Visible=false end end)
end
action.OnClientEvent:Connect(function(kind,msg) if kind=="Notice" then notify(msg) elseif kind=="TitleEarned" then notify("Title earned · "..msg) end end)
referenceScreens=require(RS:WaitForChild("HussReferenceScreens")).new(screen,notify)

-- Top status is shared with the real round events.
screen.MasterTop.Position=UDim2.new(.5,0,0,36) screen.MasterTop.Size=UDim2.fromOffset(700,64)
screen.MasterTop.AnchorPoint=Vector2.new(.5,0)
local main=screen.MasterTop.MainTimerLabel
main.Position=UDim2.fromOffset(0,0) main.Size=UDim2.new(1,0,0,36) main.TextSize=21 main.TextColor3=WHITE
main.AnchorPoint=Vector2.zero
main.FontFace=Font.new("rbxasset://fonts/families/Montserrat.json",Enum.FontWeight.Bold)
local sub=screen.MasterTop.SubStatusLabel
sub.Position=UDim2.fromOffset(0,43) sub.Size=UDim2.new(1,0,0,20) sub.TextSize=13
sub.AnchorPoint=Vector2.zero
screen.MasterTop.SafeZoneLabel.Visible=false
local round=screen.DodgerRoundLabel round.Position=UDim2.new(.5,0,0,10) round.TextSize=13 round.TextColor3=GOLD round.Visible=true
scaled(screen.MasterTop)
local topLeft=make("Frame","TopLeft",root,{Position=UDim2.fromOffset(218,10),Size=UDim2.fromOffset(90,44),BackgroundTransparency=1}) scaled(topLeft)
local questButton=button(topLeft,"Quests","QUESTS",UDim2.fromOffset(0,0),UDim2.fromOffset(90,44))
local topRight=make("Frame","TopRight",root,{AnchorPoint=Vector2.new(1,0),Position=UDim2.new(1,-14,0,8),Size=UDim2.fromOffset(390,48),BackgroundTransparency=1}) scaled(topRight)
local serversButton=button(topRight,"Servers","≡  SERVERS",UDim2.fromOffset(0,0),UDim2.fromOffset(190,46)) accent(serversButton,CYAN)
local logButton=button(topRight,"UpdateLog","▤  UPDATE LOG",UDim2.fromOffset(198,0),UDim2.fromOffset(188,46)) accent(logButton,GOLD)

local side=make("Frame","Side",root,{AnchorPoint=Vector2.new(0,.5),Position=UDim2.new(0,8,.5,0),Size=UDim2.fromOffset(48,204),BackgroundTransparency=1}) scaled(side)
local menuButton=button(side,"Menu","",UDim2.fromOffset(0,0),UDim2.fromOffset(48,48))
local arrow=text(menuButton,"Icon","›",28,UDim2.fromOffset(0,0),UDim2.fromOffset(48,28),GOLD)
text(menuButton,"Caption","MENU",11,UDim2.fromOffset(0,27),UDim2.fromOffset(48,17))
local emoteButton=button(side,"Emote","",UDim2.fromOffset(0,52),UDim2.fromOffset(48,48))
text(emoteButton,"Icon","★",24,UDim2.fromOffset(0,0),UDim2.fromOffset(48,29))
text(emoteButton,"Caption","EMOTE",10,UDim2.fromOffset(0,29),UDim2.fromOffset(48,15))
local key=panel(emoteButton,"Key",UDim2.fromOffset(34,-5),UDim2.fromOffset(21,21)) text(key,"Letter","G",12,UDim2.fromOffset(0,0),UDim2.fromScale(1,1))
local afkButton=button(side,"AFK","",UDim2.fromOffset(0,104),UDim2.fromOffset(48,48))
local afkIcon=text(afkButton,"Icon","X",22,UDim2.fromOffset(0,1),UDim2.fromOffset(48,27),Color3.fromRGB(255,97,91))
local afkCaption=text(afkButton,"Caption","AFK: Off",10,UDim2.fromOffset(0,29),UDim2.fromOffset(48,15))
local function afkChanged() local active=player:GetAttribute("AFK") afkCaption.Text=active and "AFK: On" or "AFK: Off" afkIcon.Text=active and "✓" or "X" afkIcon.TextColor3=active and Color3.fromRGB(99,255,151) or Color3.fromRGB(255,97,91) end
player:GetAttributeChangedSignal("AFK"):Connect(afkChanged) afkChanged()
afkButton.Activated:Connect(function() action:FireServer("AFK",not player:GetAttribute("AFK")) end)
emoteButton.Activated:Connect(function() if referenceScreens then referenceScreens:Open("Emotes") end end)
local spectateButton=button(side,"Spectate","",UDim2.fromOffset(0,156),UDim2.fromOffset(48,48))
text(spectateButton,"Icon","◉",24,UDim2.fromOffset(0,1),UDim2.fromOffset(48,27),CYAN)
text(spectateButton,"Caption","WATCH",9,UDim2.fromOffset(0,29),UDim2.fromOffset(48,15))
spectateButton.Activated:Connect(function() local event=screen:FindFirstChild("ToggleSpectate") if event then referenceScreens:Close() event:Fire() end end)

local currency=make("Frame","Currencies",root,{AnchorPoint=Vector2.new(0,1),Position=UDim2.new(0,14,1,-16),Size=UDim2.fromOffset(256,124),BackgroundTransparency=1}) scaled(currency)
local balances={}
for i,entry in ipairs({{"Coins","●",GOLD},{"Gems","◆",Color3.fromRGB(104,255,188)}}) do
 local f=panel(currency,entry[1],UDim2.fromOffset(0,(i-1)*70),UDim2.fromOffset(256,54)) f.ClipsDescendants=true f.BackgroundColor3=Color3.fromRGB(7,44,56) f.BackgroundTransparency=.24
 for y=0,5 do for x=0,26 do
  local tile=make("Frame","Tile",f,{Position=UDim2.fromOffset(x*10-5,y*10-5),Size=UDim2.fromOffset(7,7),Rotation=45,BorderSizePixel=0,BackgroundColor3=Color3.fromRGB(17,73,88),BackgroundTransparency=(x+y)%2==0 and .4 or .8,ZIndex=1})
 end end
 text(f,"Icon",entry[2],31,UDim2.fromOffset(9,5),UDim2.fromOffset(34,40),entry[3]).ZIndex=3
 local number=text(f,"Amount","0",25,UDim2.fromOffset(50,2),UDim2.new(1,-58,0,32),entry[3]) number.TextXAlignment=Enum.TextXAlignment.Left number.ZIndex=3
 local caption=text(f,"Caption",entry[1]:upper(),11,UDim2.fromOffset(50,32),UDim2.new(1,-58,0,15),WHITE,Enum.FontWeight.Medium) caption.TextXAlignment=Enum.TextXAlignment.Left caption.ZIndex=3
 balances[entry[1]]=number
end
task.spawn(function()
 local stats=player:WaitForChild("leaderstats")
 for name,label in pairs(balances) do local value=stats:WaitForChild(name) label.Text=comma(value.Value) value.Changed:Connect(function(v) label.Text=comma(v) end) end
end)

local bottom=make("Frame","Bottom",root,{AnchorPoint=Vector2.new(.5,1),Position=UDim2.new(.5,0,1,-12),Size=UDim2.fromOffset(660,56),BackgroundTransparency=1}) scaled(bottom)
text(bottom,"DashTitle","SPACE  ·  DASH",17,UDim2.fromOffset(0,4),UDim2.fromOffset(660,25))
local dashState=text(bottom,"DashState","DASH PAUSED",12,UDim2.fromOffset(0,28),UDim2.fromOffset(230,18)) dashState.TextXAlignment=Enum.TextXAlignment.Left
local dashHint=text(bottom,"DashHint","Waiting for movement",12,UDim2.fromOffset(260,28),UDim2.fromOffset(400,18),WHITE,Enum.FontWeight.Medium) dashHint.TextXAlignment=Enum.TextXAlignment.Right
local track=make("Frame","DashTrack",bottom,{Position=UDim2.fromOffset(0,49),Size=UDim2.fromOffset(660,9),BackgroundColor3=Color3.fromRGB(45,53,49),BorderSizePixel=0}) corner(track,5) stroke(track,Color3.new(0,0,0),1)
local fill=make("Frame","Fill",track,{Size=UDim2.fromScale(1,1),BackgroundColor3=Color3.fromRGB(219,243,219),BorderSizePixel=0}) corner(fill,5)

-- Menu panel mirrors the reference; every tile has a working destination.
local menu=panel(root,"MenuPanel",UDim2.new(0,70,.5,-164),UDim2.fromOffset(268,328)) scaled(menu) menu.Visible=false
local shop=button(menu,"Shop","SHOP",UDim2.fromOffset(14,14),UDim2.fromOffset(116,68)) accent(shop,GOLD)
local balls=button(menu,"Inventory","INVENTORY",UDim2.fromOffset(138,14),UDim2.fromOffset(116,68)) accent(balls,Color3.fromRGB(106,231,146))
local journey=button(menu,"Journey","JOURNEY",UDim2.fromOffset(14,90),UDim2.fromOffset(116,68))
local afkMenu,afkMenuLabel=button(menu,"AFK","AFK: Off",UDim2.fromOffset(138,90),UDim2.fromOffset(116,68))
local settings=button(menu,"Settings","SETTINGS",UDim2.fromOffset(14,166),UDim2.fromOffset(240,68)) accent(settings,WHITE)
text(settings,"Icon","⚙",29,UDim2.fromOffset(12,0),UDim2.fromOffset(33,35),Color3.fromRGB(255,88,107))
for _,b in ipairs({shop,balls,journey,afkMenu,settings}) do
 b.Label.Position=UDim2.new(0,12,1,-30) b.Label.Size=UDim2.new(1,-24,0,23) b.Label.TextXAlignment=Enum.TextXAlignment.Left b.Label.TextSize=17
end
local music,musicLabel=button(menu,"Music","♫  MUSIC · ON",UDim2.fromOffset(14,242),UDim2.fromOffset(240,40)) accent(music,Color3.fromRGB(97,255,132))
text(menu,"CursorHint","CTRL  ·  SHIFT LOCK",11,UDim2.fromOffset(0,292),UDim2.fromOffset(268,20),WHITE,Enum.FontWeight.Medium)
player:GetAttributeChangedSignal("AFK"):Connect(function() afkMenuLabel.Text=player:GetAttribute("AFK") and "AFK: On" or "AFK: Off" end)
afkMenu.Activated:Connect(function() action:FireServer("AFK",not player:GetAttribute("AFK")) end)
local modal=panel(root,"Panel",UDim2.fromScale(.5,.5),UDim2.fromOffset(620,420)) modal.AnchorPoint=Vector2.new(.5,.5) scaled(modal) modal.Visible=false
local title=text(modal,"Title","BALLS",25,UDim2.fromOffset(22,14),UDim2.fromOffset(520,40)) title.TextXAlignment=Enum.TextXAlignment.Left
local close=button(modal,"Close","×",UDim2.new(1,-52,0,16),UDim2.fromOffset(36,36))
local body=make("Frame","Body",modal,{Position=UDim2.fromOffset(22,66),Size=UDim2.new(1,-44,1,-88),BackgroundTransparency=1})
local activePanel=nil local renderPanel
local function modalChanged() player:SetAttribute("HussHudModalOpen",menu.Visible or modal.Visible) arrow.Text=menu.Visible and "‹" or "›" end
local function open(name)
 menu.Visible=false modal.Visible=false activePanel=nil
 if name=="Shop" or name=="Inventory" or name=="Balls" or name=="Titles" or name=="Servers" or name=="Update Log" then referenceScreens:Open(name) return end
 referenceScreens:Close() modal.Visible=true activePanel=name renderPanel(name) modalChanged()
end
close.Activated:Connect(function() modal.Visible=false activePanel=nil modalChanged() end)
menuButton.Activated:Connect(function() referenceScreens:Close() menu.Visible=not menu.Visible modal.Visible=false activePanel=nil modalChanged() end)
shop.Activated:Connect(function() open("Shop") end) balls.Activated:Connect(function() open("Inventory") end)
journey.Activated:Connect(function() open("Journey") end) settings.Activated:Connect(function() open("Settings") end)
questButton.Activated:Connect(function() open("Quests") end) logButton.Activated:Connect(function() open("Update Log") end)
serversButton.Activated:Connect(function() open("Servers") end)
local musicOn=true
local muted={}
local function updateMusic()
 musicLabel.Text=musicOn and "♫  MUSIC · ON" or "♫  MUSIC · OFF"
 for _,s in ipairs(game:GetDescendants()) do if s:IsA("Sound") and (s:IsDescendantOf(SoundService) or s.Name:lower():find("music")) then
  if musicOn then if muted[s] then s.Volume=muted[s] muted[s]=nil end else if muted[s]==nil then muted[s]=s.Volume end s.Volume=0 end
 end end
end
music.Activated:Connect(function() musicOn=not musicOn updateMusic() end)
local catalog={{"Classic","CLASSIC BALL",0,Color3.fromRGB(255,77,64)},{"Ocean","OCEAN BALL",100,Color3.fromRGB(53,194,255)},{"Lime","LIME BALL",150,Color3.fromRGB(99,255,151)},{"Gold","GOLD BALL",250,GOLD}}
local function paragraph(value,y,h)
 local l=text(body,"Paragraph",value,15,UDim2.fromOffset(0,y),UDim2.new(1,0,0,h),WHITE,Enum.FontWeight.Medium) l.TextWrapped=true l.TextXAlignment=Enum.TextXAlignment.Left l.TextYAlignment=Enum.TextYAlignment.Top return l
end
local inventoryMode="Titles"
local inventoryScroll=Vector2.zero
renderPanel=function(name)
 local oldList=body:FindFirstChild("TitleList")
 if oldList then inventoryScroll=oldList.CanvasPosition end
 title.Text=name:upper() body:ClearAllChildren()
 if name=="Inventory" then
  local earnedCount=0
  for _,item in ipairs(titleCatalog.Items) do if player:GetAttribute("OwnedTitle_"..item.Id) then earnedCount+=1 end end
  local titleTab=button(body,"TitlesTab",string.format("TITLES  ·  %d / 20",earnedCount),UDim2.fromOffset(0,0),UDim2.new(.5,-5,0,34),inventoryMode=="Titles" and GOLD or WHITE)
  local ballTab=button(body,"BallsTab","BALLS",UDim2.new(.5,5,0,0),UDim2.new(.5,-5,0,34),inventoryMode=="Balls" and CYAN or WHITE)
  titleTab.Activated:Connect(function() inventoryMode="Titles" renderPanel(name) end)
  ballTab.Activated:Connect(function() inventoryMode="Balls" renderPanel(name) end)
  accent(inventoryMode=="Titles" and titleTab or ballTab,inventoryMode=="Titles" and GOLD or CYAN)
  if inventoryMode=="Titles" then
   local equipped=player:GetAttribute("EquippedTitle") or ""
   local current=titleCatalog.ById[equipped]
   local summary=text(body,"CurrentTitle",current and ("Wearing "..current.Name) or (player:GetAttribute("TitlesReady")==false and "Loading your achievements…" or (player:GetAttribute("TitlesPersistence")=="Unavailable" and "Progress unavailable · this session will not save" or "Earn titles through wins, tags, catches and slides")),12,UDim2.fromOffset(0,42),UDim2.new(1,-100,0,22),current and current.Color or WHITE,Enum.FontWeight.Medium)
   summary.TextXAlignment=Enum.TextXAlignment.Left
   local clear=button(body,"ClearTitle","REMOVE",UDim2.new(1,-92,0,39),UDim2.fromOffset(92,26))
   clear.Label.TextSize=11 clear.Activated:Connect(function() action:FireServer("Title","") end)
   local list=make("ScrollingFrame","TitleList",body,{Position=UDim2.fromOffset(0,73),Size=UDim2.new(1,0,1,-73),BackgroundTransparency=1,BorderSizePixel=0,ScrollBarThickness=4,ScrollBarImageColor3=Color3.fromRGB(136,158,170),CanvasSize=UDim2.fromOffset(0,0),AutomaticCanvasSize=Enum.AutomaticSize.Y,ScrollingDirection=Enum.ScrollingDirection.Y})
   make("UIPadding","Padding",list,{PaddingLeft=UDim.new(0,3),PaddingTop=UDim.new(0,3),PaddingRight=UDim.new(0,9),PaddingBottom=UDim.new(0,6)})
   make("UIGridLayout","Grid",list,{CellSize=UDim2.new(.5,-10,0,104),CellPadding=UDim2.fromOffset(10,10),SortOrder=Enum.SortOrder.LayoutOrder})
   for i,item in ipairs(titleCatalog.Items) do
    local owned=player:GetAttribute("OwnedTitle_"..item.Id)==true
    local selected=equipped==item.Id
    local ratio=0 local counts={}
    for _,r in ipairs(item.Requirements) do
     local value=math.min(r.Goal,player:GetAttribute("TitleProgress_"..r.Key) or 0)
     ratio+=value/r.Goal
     table.insert(counts,string.format("%d / %d",value,r.Goal))
    end
    ratio/=math.max(1,#item.Requirements)
    local card=button(list,"Title_"..item.Id,"",UDim2.fromOffset(0,0),UDim2.fromOffset(260,104))
    card.LayoutOrder=selected and 0 or (owned and i or 100+i)
    card.BackgroundColor3=Color3.fromRGB(20,27,31):Lerp(item.Color,owned and .07 or .015)
    card.BackgroundTransparency=owned and .08 or .2
    card.Border.Color=selected and item.Color or (owned and Color3.fromRGB(72,94,104) or Color3.fromRGB(14,22,27))
    local style=text(card,"Style",item.Style,9,UDim2.fromOffset(14,7),UDim2.new(1,-100,0,12),Color3.fromRGB(145,162,174),Enum.FontWeight.Medium) style.TextXAlignment=Enum.TextXAlignment.Left
    local badge=text(card,"Badge",selected and "EQUIPPED" or (owned and "EARNED" or "LOCKED"),9,UDim2.new(1,-87,0,7),UDim2.fromOffset(73,12),owned and item.Color or Color3.fromRGB(139,150,157),Enum.FontWeight.Bold) badge.TextXAlignment=Enum.TextXAlignment.Right
    local label=text(card,"TitleName",item.Name,18,UDim2.fromOffset(14,23),UDim2.new(1,-28,0,23),owned and item.Color or item.Color:Lerp(Color3.fromRGB(181,193,201),.4),Enum.FontWeight.Heavy)
    label.TextXAlignment=Enum.TextXAlignment.Left label.TextScaled=true
    make("UITextSizeConstraint","TextLimit",label,{MinTextSize=12,MaxTextSize=18})
    local requirement=text(card,"Requirement",item.Description,11,UDim2.fromOffset(14,49),UDim2.new(1,-28,0,28),Color3.fromRGB(183,197,207),Enum.FontWeight.Medium)
    requirement.TextWrapped=true requirement.TextXAlignment=Enum.TextXAlignment.Left requirement.TextYAlignment=Enum.TextYAlignment.Top
    local status=text(card,"Status",selected and "✓ Wearing this title" or (owned and "✓ Earned · tap to equip" or table.concat(counts,"  ·  ")),10,UDim2.fromOffset(14,80),UDim2.new(1,-28,0,14),owned and item.Color or Color3.fromRGB(152,173,187),Enum.FontWeight.Medium)
    status.TextXAlignment=Enum.TextXAlignment.Left
    local progress=make("Frame","ProgressTrack",card,{Position=UDim2.new(0,14,1,-6),Size=UDim2.new(1,-28,0,2),BackgroundColor3=Color3.fromRGB(54,66,73),BorderSizePixel=0})
    make("Frame","ProgressFill",progress,{Size=UDim2.fromScale(owned and 1 or ratio,1),BackgroundColor3=item.Color,BackgroundTransparency=owned and 0 or .28,BorderSizePixel=0})
    card.Activated:Connect(function() if owned then action:FireServer("Title",item.Id) end end)
   end
   task.defer(function() if list.Parent then list.CanvasPosition=inventoryScroll end end)
   return
  else
   -- Reuse the existing ball cards inside the inventory.
   local tabContainer=body
   local content=make("Frame","BallContent",body,{Position=UDim2.fromOffset(0,40),Size=UDim2.new(1,0,1,-40),BackgroundTransparency=1})
   local originalBody=body body=content
   renderPanel("Balls")
   body=originalBody title.Text="INVENTORY"
   return
  end
 elseif name=="Balls" or name=="Shop" then
  paragraph("Choose your ball. Earn coins from wins, tags, catches, and quests.",0,35)
  for i,item in ipairs(catalog) do
   local owned=player:GetAttribute("OwnedBall_"..item[1]) local equipped=player:GetAttribute("EquippedBall")==item[1]
   local card=button(body,"Ball_"..item[1],"",UDim2.fromOffset(((i-1)%2)*288,43+math.floor((i-1)/2)*130),UDim2.fromOffset(278,120))
   local ball=make("Frame","BallIcon",card,{Position=UDim2.fromOffset(15,20),Size=UDim2.fromOffset(68,68),BackgroundColor3=item[4],BorderSizePixel=0}) corner(ball,99) stroke(ball,Color3.fromRGB(5,13,19),2)
   make("UIGradient","Shade",ball,{Color=ColorSequence.new(Color3.new(1,1,1),Color3.fromRGB(75,75,75)),Rotation=55})
   local shine=make("Frame","Shine",ball,{Position=UDim2.fromOffset(14,10),Size=UDim2.fromOffset(16,9),BackgroundColor3=Color3.new(1,1,1),BackgroundTransparency=.5,BorderSizePixel=0}) corner(shine,9)
   text(card,"Name",item[2],14,UDim2.fromOffset(89,19),UDim2.fromOffset(182,28))
   text(card,"Action",equipped and "EQUIPPED" or (owned and "TAP TO EQUIP" or item[3].." COINS"),12,UDim2.fromOffset(89,59),UDim2.fromOffset(182,28),equipped and Color3.fromRGB(100,255,163) or GOLD)
   accent(card,item[4]) card.Activated:Connect(function() action:FireServer("Ball",item[1]) end)
  end
 elseif name=="Quests" then
  for i,q in ipairs({{"Tag","Tag 3 dodgers","SessionTags",3,60},{"Catch","Catch 2 balls","SessionCatches",2,60},{"Win","Win as a dodger","SessionDodgerWins",1,100}}) do
   local claimed=player:GetAttribute("ClaimedQuest_"..q[1]) local progress=math.min(q[4],player:GetAttribute(q[3]) or 0)
   local card=button(body,"Quest_"..q[1],"",UDim2.fromOffset(0,(i-1)*90),UDim2.new(1,0,0,80))
   local l=text(card,"Name",q[2],17,UDim2.fromOffset(14,9),UDim2.new(1,-30,0,26)) l.TextXAlignment=Enum.TextXAlignment.Left
   local l2=text(card,"Details",claimed and "CLAIMED" or string.format("%d / %d  ·  %d COINS  ·  %s",progress,q[4],q[5],progress>=q[4] and "TAP TO CLAIM" or "IN PROGRESS"),12,UDim2.fromOffset(14,41),UDim2.new(1,-30,0,24),GOLD) l2.TextXAlignment=Enum.TextXAlignment.Left
   card.Activated:Connect(function() action:FireServer("Quest",q[1]) end)
  end
  paragraph("Quest progress and currencies last for this server session.",279,30)
 elseif name=="Journey" then
  local stats=player:FindFirstChild("leaderstats")
  local wins=stats and stats:FindFirstChild("Wins") local level=stats and stats:FindFirstChild("Level")
  paragraph(player.DisplayName.."\n\nLEVEL "..(level and level.Value or 1).."    ·    "..(wins and wins.Value or 0).." WINS\n\nDodger wins this session: "..(player:GetAttribute("SessionDodgerWins") or 0).."\nBalls caught: "..(player:GetAttribute("SessionCatches") or 0).."\nDodgers tagged: "..(player:GetAttribute("SessionTags") or 0).."\n\nLast dodger victory took "..(remotes:GetAttribute("LastDodgerWinRounds") or 0).." matches.",0,290)
 elseif name=="Settings" then
  local fx=player:GetAttribute("HussVFXEnabled")~=false
  local b=button(body,"VFX","SLIDE VFX · "..(fx and "ON" or "OFF"),UDim2.fromOffset(0,0),UDim2.new(1,0,0,54))
  b.Activated:Connect(function() player:SetAttribute("HussVFXEnabled",not fx) renderPanel(name) end)
  local sens=player:GetAttribute("HussSensitivity") or .6
  local b2=button(body,"Sensitivity",string.format("MOUSE SENSITIVITY · %d%%",sens*100),UDim2.fromOffset(0,66),UDim2.new(1,0,0,54))
  b2.Activated:Connect(function() local nextValue=sens==.6 and .4 or (sens==.4 and 1 or .6) player:SetAttribute("HussSensitivity",nextValue) UIS.MouseDeltaSensitivity=nextValue renderPanel(name) end)
  paragraph("SPACE / C · Dash-slide\nF / E · Catch ball\nG · Lobby emote\nCTRL · Roblox shift-lock\n\nOne fixed movement speed. Slide cooldown: 1.2 seconds.",143,175)
 elseif name=="Update Log" then
  paragraph("HUSS BALLEY\n\n• Ball equipment and four ball colors\n• New HUD, menu, quests, and currency cards\n• Short directional slides with slide VFX\n• Two maps with live voting\n• Nametags and matches-until-dodger-win counter\n\nWins: +50 coins, +5 gems. Tags and catches: +10 coins.",0,320)
 end
end
local panelRefreshQueued=false
player.AttributeChanged:Connect(function(name)
 if activePanel and (name:find("Ball") or name:find("Quest") or name:find("Session") or name:find("Title")) and not panelRefreshQueued then
  panelRefreshQueued=true
  task.delay(.03,function()
   panelRefreshQueued=false
   if activePanel then renderPanel(activePanel) end
  end)
 end
end)
UIS.InputBegan:Connect(function(input,processed)
 if UIS:GetFocusedTextBox() or processed then return end
 if input.KeyCode==Enum.KeyCode.G then if referenceScreens.Root:FindFirstChild("EmoteWheel") then referenceScreens:Close() else referenceScreens:Open("Emotes") end

 elseif input.KeyCode==Enum.KeyCode.Escape then menu.Visible=false modal.Visible=false activePanel=nil modalChanged() end
end)

-- Small lobby ballot remains usable without covering the arena.
local compact=make("Frame","CompactVoting",root,{AnchorPoint=Vector2.new(.5,0),Position=UDim2.new(.5,0,0,106),Size=UDim2.fromOffset(424,100),BackgroundTransparency=1}) scaled(compact)
local expandArrow=button(compact,"ExpandArrow","↗",UDim2.fromOffset(389,-7),UDim2.fromOffset(35,29))
expandArrow.Label.TextSize=17 expandArrow.Activated:Connect(function() referenceScreens:Close() screen.MapVotingFrame.Visible=true compact.Visible=false end)
local voteTimer=text(compact,"VoteTimer","0s",12,UDim2.fromOffset(330,-2),UDim2.fromOffset(48,24),GOLD)
local mapCaption=text(compact,"Caption","Vote for the next map",14,UDim2.fromOffset(0,0),UDim2.fromOffset(424,22)) mapCaption.TextXAlignment=Enum.TextXAlignment.Left
local mapButtons={}
for i,id in ipairs({"Classic Valley","Desert Canyon"}) do
 local b=button(compact,"Map"..i,"",UDim2.fromOffset((i-1)*216,28),UDim2.fromOffset(208,50)) b.BackgroundColor3=Color3.fromRGB(23,69,44) b.BackgroundTransparency=.4
 local n=text(b,"Name",id:upper(),11,UDim2.fromOffset(9,2),UDim2.fromOffset(185,20)) n.TextXAlignment=Enum.TextXAlignment.Left
 local v=text(b,"Votes","Tap to vote · 0",11,UDim2.fromOffset(42,25),UDim2.fromOffset(155,19),WHITE,Enum.FontWeight.Medium) v.TextXAlignment=Enum.TextXAlignment.Left
 local source=screen.MapVotingFrame.Cards:FindFirstChild(i==1 and "Card_ClassicValley" or "Card_DesertCanyon")
 if source and source:FindFirstChild("Preview") then
  local icon=source.Preview:Clone() icon.Name="MapIcon" icon.Position=UDim2.fromOffset(7,24) icon.Size=UDim2.fromOffset(29,22) icon.BackgroundTransparency=1 icon.Parent=b
 end
 b.Activated:Connect(function() remotes.VoteMap:FireServer(id) end) mapButtons[id]={button=b,votes=v}
end
local expand=make("TextButton","Expand",compact,{Position=UDim2.fromOffset(0,82),Size=UDim2.fromOffset(424,18),BackgroundTransparency=1,Text="Optional · tap a map to vote · ↗ expand",TextColor3=WHITE,TextSize=11,FontFace=Font.new("rbxasset://fonts/families/Montserrat.json",Enum.FontWeight.Medium),TextXAlignment=Enum.TextXAlignment.Left}) stroke(expand,Color3.new(0,0,0),1)
expand.Activated:Connect(function() referenceScreens:Close() screen.MapVotingFrame.Visible=true compact.Visible=false end)
screen.MapVotingFrame:GetPropertyChangedSignal("Visible"):Connect(function() compact.Visible=remotes:GetAttribute("MapVoteOpen")==true and not screen.MapVotingFrame.Visible end)
local function ballot()
 compact.Visible=remotes:GetAttribute("MapVoteOpen")==true and not screen.MapVotingFrame.Visible
 local ok,counts=pcall(HttpService.JSONDecode,HttpService,remotes:GetAttribute("MapVoteCounts") or "{}")
 for id,data in pairs(mapButtons) do data.votes.Text="Tap to vote · "..(ok and counts[id] or 0) data.button.Border.Color=player:GetAttribute("SelectedMapVote")==id and Color3.fromRGB(121,255,146) or Color3.fromRGB(3,10,5) end
 mapCaption.Text="Vote for the next map" voteTimer.Text=remotes:GetAttribute("RoundState")=="Waiting" and "OPEN" or (remotes:GetAttribute("MapVoteTimeLeft") or 0).."s"
end
for _,key in ipairs({"MapVoteCounts","MapVoteOpen","MapVoteTimeLeft"}) do remotes:GetAttributeChangedSignal(key):Connect(ballot) end
player:GetAttributeChangedSignal("SelectedMapVote"):Connect(ballot) ballot()
local state="Waiting" local role=player:GetAttribute("PlayerRole") or "Lobby"
local function roundLabel()
 local count=remotes:GetAttribute("RoundValue") or 0
 round.Text=string.format("ROUND %02d",math.max(1,count))
 if state=="Waiting" or state=="Intermission" then round.Text="LOBBY" end
 round.Visible=true
end
remotes:GetAttributeChangedSignal("RoundValue"):Connect(roundLabel)
remotes.RoundStatus.OnClientEvent:Connect(function(s,left,runners,throwers)
 state=s left=tonumber(left) or 0
 if s=="Waiting" then main.Text="Choose the next map — no votes keeps this one." sub.Text=player:GetAttribute("AFK") and "AFK · Sitting out next match" or "Waiting for players"
 elseif s=="Intermission" then main.Text="Choose the next map — no votes keeps this one." sub.Text="Next match in "..left.."s"
 elseif s=="Active" then main.Text=role=="Thrower" and "Tag the dodgers — throw your ball!" or "Dodge the balls — cross the line!" sub.Text=(role=="Thrower" and "Chaser" or (role=="Runner" and "Dodger" or "Spectator")).."  ·  "..string.format("%d:%02d",math.floor(left/60),left%60)
 else main.Text="ROUND OVER" sub.Text="Next match starts soon" end
 main.TextColor3=WHITE sub.TextColor3=s=="Waiting" and GOLD or WHITE roundLabel()
end)
remotes.RoleAssigned.OnClientEvent:Connect(function(r) role=r end)
local announcementToken=0
local banner=screen.AnnouncementBanner banner.BackgroundTransparency=1
banner.Position=UDim2.new(.5,0,0,36) banner.Size=UDim2.fromOffset(750,64) banner.AnchorPoint=Vector2.new(.5,0) scaled(banner)
banner.Title.Position=UDim2.fromOffset(0,0) banner.Title.Size=UDim2.new(1,0,0,38) banner.Title.TextSize=23 banner.Title.FontFace=main.FontFace
banner.Title.AnchorPoint=Vector2.zero
banner.Subtitle.Position=UDim2.fromOffset(0,43) banner.Subtitle.Size=UDim2.new(1,0,0,20) banner.Subtitle.TextSize=13
banner.Subtitle.AnchorPoint=Vector2.zero
remotes.Announcement.OnClientEvent:Connect(function(t,s)
 announcementToken+=1 local token=announcementToken banner.Title.Text=t banner.Subtitle.Text=s or "" banner.Title.TextColor3=WHITE banner.Visible=true screen.MasterTop.Visible=false
 task.delay(2.2,function() if token==announcementToken then banner.Visible=false screen.MasterTop.Visible=true end end)
end)
roundLabel()
local lastSlide=-math.huge
RunService.RenderStepped:Connect(function()
 local camera=workspace.CurrentCamera
 if camera then local view=camera.ViewportSize local scale=math.min(1,view.X/1100,view.Y/650) for _,s in ipairs(scaleTargets) do s.Scale=scale end end
 local char=player.Character local hum=char and char:FindFirstChildOfClass("Humanoid")
 local slide=char and char:GetAttribute("SlideStart") if slide then lastSlide=slide end
 local now=workspace:GetServerTimeNow() local cooldown=math.max(0,movementConfig.SlideCooldown-(now-lastSlide))
 local moving=hum and hum.MoveDirection.Magnitude>.1 local grounded=hum and hum.FloorMaterial~=Enum.Material.Air
 local sliding=slide and now-slide<movementConfig.SlideDuration

 dashState.Text=sliding and "DASHING" or (cooldown>0 and "DASH RECHARGING" or (moving and grounded and "DASH READY" or "DASH PAUSED"))
 dashHint.Text=cooldown>0 and string.format("%.1fs",cooldown) or (moving and grounded and "Press Space to slide" or "Waiting for movement")
 fill.Size=UDim2.fromScale(1-cooldown/movementConfig.SlideCooldown,1) fill.BackgroundColor3=sliding and CYAN or Color3.fromRGB(219,243,219)




end)


script.Destroying:Connect(function() player:SetAttribute("HussHudModalOpen",false) player:SetAttribute("HussFreeCursorRequested",false) end)

