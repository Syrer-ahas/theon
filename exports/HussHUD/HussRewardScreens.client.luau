local Players=game:GetService("Players")
local RS=game:GetService("ReplicatedStorage")
local Tween=game:GetService("TweenService")
local Run=game:GetService("RunService")
local UIS=game:GetService("UserInputService")
local p=Players.LocalPlayer
local screen=p.PlayerGui:WaitForChild("HussGameGui")
local remotes=RS:WaitForChild("GameRemotes")
local gold=Color3.fromRGB(255,196,20)
local green=Color3.fromRGB(27,234,46)
local blue=Color3.fromRGB(0,132,255)
local font=Font.new("rbxasset://fonts/families/Montserrat.json",Enum.FontWeight.Heavy)
local function make(class,parent,props)
 local o=Instance.new(class) for k,v in pairs(props or {}) do o[k]=v end o.Parent=parent return o
end
local function round(o,r) make("UICorner",o,{CornerRadius=r or UDim.new(0,12)}) end
local function stroke(o,color,t) make("UIStroke",o,{Color=color or Color3.new(),Thickness=t or 3}) end
local function label(parent,name,txt,size,pos,dims,color)
 local l=make("TextLabel",parent,{Name=name,Text=txt,TextSize=size,FontFace=font,TextColor3=color or Color3.new(1,1,1),BackgroundTransparency=1,Position=pos,Size=dims})
 stroke(l,Color3.new(),2) return l
end
local function panel(parent,name,pos,size,color)
 local f=make("Frame",parent,{Name=name,Position=pos,Size=size,BackgroundColor3=color or Color3.fromRGB(20,36,28),BackgroundTransparency=.2}) round(f) stroke(f) return f
end
local function button(parent,name,txt,pos,size,color)
 local b=make("TextButton",parent,{Name=name,Text="",Position=pos,Size=size,BackgroundColor3=color or Color3.fromRGB(135,135,135)}) round(b,UDim.new(0,9)) stroke(b) b.UIStroke.ApplyStrokeMode=Enum.ApplyStrokeMode.Border
 label(b,"Label",txt,22,UDim2.new(),UDim2.fromScale(1,1)) return b
end
local root=make("Frame",screen,{Name="RewardScreens",Size=UDim2.fromScale(1,1),BackgroundTransparency=1,ZIndex=250})
local results=panel(root,"Results",UDim2.fromScale(.5,.5),UDim2.fromOffset(800,550))
results.AnchorPoint=Vector2.new(.5,.5) results.Visible=false
local resultsScale=make("UIScale",results,{})
local heading=label(results,"Winner","Dodgers Win",40,UDim2.fromOffset(130,8),UDim2.fromOffset(540,50))
local nextMatch=label(results,"NextMatch","Next match · 16s",18,UDim2.fromOffset(15,26),UDim2.fromOffset(220,30))
label(results,"Subtitle","Match MVP",23,UDim2.fromOffset(260,54),UDim2.fromOffset(280,35),gold)
local closeResult=button(results,"Close","X",UDim2.fromOffset(732,14),UDim2.fromOffset(50,48),Color3.fromRGB(255,54,84))
local cards=make("Frame",results,{Name="Podium",Position=UDim2.fromOffset(36,145),Size=UDim2.fromOffset(728,246),BackgroundTransparency=1})
local xpGain=label(results,"Gain","",29,UDim2.fromOffset(150,395),UDim2.fromOffset(500,40),gold)
local breakdown=label(results,"Breakdown","",15,UDim2.fromOffset(40,437),UDim2.fromOffset(720,28))
local up=label(results,"LevelUp","",22,UDim2.fromOffset(595,397),UDim2.fromOffset(180,35),gold)
local currentLevel=label(results,"Level","Lvl 1",24,UDim2.fromOffset(17,501),UDim2.fromOffset(86,35))
local nextLevel=label(results,"NextLevel","Lvl 2",24,UDim2.fromOffset(701,501),UDim2.fromOffset(82,35))
local track=panel(results,"XPBar",UDim2.fromOffset(108,508),UDim2.fromOffset(585,22),Color3.fromRGB(65,65,65))
track.BackgroundTransparency=0
local fill=make("Frame",track,{Name="Fill",Size=UDim2.fromScale(0,1),BackgroundColor3=gold}) round(fill)
local xpText=label(track,"Value","0/100 XP",14,UDim2.new(),UDim2.fromScale(1,1))
local wheelRoot
local payload local metric="XP" local endsAt=0
local function renderPodium()
 cards:ClearAllChildren() if not payload then return end
 local rows=table.clone(payload.Rows) table.sort(rows,function(a,b) return a[metric]==b[metric] and a.UserId<b.UserId or a[metric]>b[metric] end)
 local rank=0 local previous local count=0
 for i,row in ipairs(rows) do if i>3 then break end
  if row[metric]~=previous then rank=i previous=row[metric] end count+=1
  local x=({234,8,493})[i] local y=i==1 and 0 or 16
  local card=panel(cards,"Rank"..i,UDim2.fromOffset(x,y),UDim2.fromOffset(i==1 and 245 or 218,i==1 and 246 or 218),i==1 and Color3.fromRGB(90,102,28) or Color3.fromRGB(22,59,36))
  if i==1 then stroke(card,gold,2) end
  label(card,"Rank",(rank==1 and "#1" or ((rows[i-1] and rows[i-1][metric]==row[metric]) or (rows[i+1] and rows[i+1][metric]==row[metric])) and "Joint #"..rank or "#"..rank),25,UDim2.fromOffset(0,3),UDim2.new(1,0,0,30),i==1 and gold or Color3.new(1,1,1))
  local avatarPlayer=Players:GetPlayerByUserId(row.UserId)
  if avatarPlayer and avatarPlayer.Character then
   local image=make("ViewportFrame",card,{Name="Avatar",BackgroundTransparency=1,Position=UDim2.fromOffset(12,32),Size=UDim2.new(1,-24,1,-78),Ambient=Color3.fromRGB(200,200,200),LightColor=Color3.new(1,1,1)})
   local character=avatarPlayer.Character local previousArchive=character.Archivable character.Archivable=true local model=character:Clone() character.Archivable=previousArchive
   for _,object in ipairs(model:GetDescendants()) do if object:IsA("BaseScript") or object:IsA("BillboardGui") or object:IsA("Highlight") or object:IsA("Tool") then object:Destroy() elseif object:IsA("BasePart") then object.Anchored=true end end
   local world=make("WorldModel",image,{}) model:PivotTo(CFrame.identity) model.Parent=world
   local head=model:FindFirstChild("Head") local target=head and head.Position-Vector3.new(0,.7,0) or Vector3.new(0,1.2,0)
   local camera=make("Camera",image,{CFrame=CFrame.lookAt(target+Vector3.new(0,0,-5.5),target),FieldOfView=42}) image.CurrentCamera=camera
  else
   local image=make("ImageLabel",card,{Name="Avatar",BackgroundTransparency=1,Position=UDim2.fromOffset(12,32),Size=UDim2.new(1,-24,1,-78),ScaleType=Enum.ScaleType.Fit})
   task.spawn(function() local ok,url=pcall(function() return Players:GetUserThumbnailAsync(row.UserId,Enum.ThumbnailType.AvatarBust,Enum.ThumbnailSize.Size420x420) end) if ok and image.Parent then image.Image=url end end)
  end
  label(card,"Name",row.Name,19,UDim2.new(0,3,1,-60),UDim2.new(1,-6,0,28)).TextTruncate=Enum.TextTruncate.AtEnd
  label(card,"Score",tostring(row[metric])..(metric=="XP" and " XP" or metric=="Survival" and "s" or " catches"),26,UDim2.new(0,0,1,-33),UDim2.new(1,0,0,32),gold)
 end
 if count==0 then label(cards,"Empty","No eligible match results",22,UDim2.new(),UDim2.fromScale(1,1)) end
end
for i,entry in ipairs({{"MVP","XP"},{"Survival","Survival"},{"Catches","Catches"}}) do
 local b=button(results,entry[1],entry[1],UDim2.fromOffset(198+(i-1)*136,97),UDim2.fromOffset(129,38),i==1 and green or Color3.fromRGB(140,140,140))
 b.Label.TextSize=16
 b.Activated:Connect(function() metric=entry[2] for _,e in ipairs({"MVP","Survival","Catches"}) do results[e].BackgroundColor3=e==entry[1] and green or Color3.fromRGB(140,140,140) end renderPodium() end)
end
local function restoreHUD() local hud=screen:FindFirstChild("ReferenceHUD") if hud then hud.Visible=true end p:SetAttribute("HussHudModalOpen",false) end
closeResult.BackgroundTransparency=1 closeResult.UIStroke.Enabled=false closeResult.Label.TextSize=48 closeResult.Label.TextColor3=Color3.fromRGB(255,54,84)
closeResult.Activated:Connect(function() results.Visible=false restoreHUD() end)
remotes:WaitForChild("MatchResults").OnClientEvent:Connect(function(data)
 if wheelRoot then wheelRoot.Visible=false end
 local hud=screen:FindFirstChild("ReferenceHUD") if hud then hud.Visible=false end p:SetAttribute("HussHudModalOpen",true)
 payload=data metric="XP" endsAt=data.NextMatchAt results.Visible=true renderPodium()
 heading.Text=data.Winner.." Win"
 local own=data.Personal xpGain.Text="+"..own.Gain.." XP"
 breakdown.Text="Survival +"..own.Survival.." · Catches +"..own.Catches.." · Tags +"..own.Tags.." · Win +"..own.Win
 up.Text=own.Level>own.BeforeLevel and "Level Up!" or ""
 currentLevel.Text="Lvl "..own.Level nextLevel.Text="Lvl "..(own.Level+1)
 xpText.Text=own.XP.."/"..own.Required.." XP"
 fill.Size=UDim2.fromScale(0,1) Tween:Create(fill,TweenInfo.new(.8,Enum.EasingStyle.Quart),{Size=UDim2.fromScale(own.XP/own.Required,1)}):Play()
end)

local Art=require(RS:WaitForChild("HussPrizeWheelArt"))
local dim=make("Frame",root,{Name="WheelDim",Size=UDim2.fromScale(1,1),BackgroundColor3=Color3.fromRGB(3,9,17),BackgroundTransparency=1,Visible=false,ZIndex=0})
wheelRoot=panel(root,"Wheel",UDim2.fromScale(.5,.5),UDim2.fromOffset(1140,760),Color3.fromRGB(15,25,34))
wheelRoot.AnchorPoint=Vector2.new(.5,.5) wheelRoot.BackgroundTransparency=1 wheelRoot.Visible=false
wheelRoot.UIStroke.Enabled=false
make("UIGradient",wheelRoot,{Color=ColorSequence.new(Color3.fromRGB(30,49,61),Color3.fromRGB(9,18,28)),Rotation=75})
local wheelScale=make("UIScale",wheelRoot,{})
local brand=label(wheelRoot,"Brand","HUSS BALLEY",29,UDim2.fromOffset(30,20),UDim2.fromOffset(400,38)) brand.TextXAlignment=Enum.TextXAlignment.Left
local subtitle=label(wheelRoot,"Subtitle","PRIZE WHEEL  /  FREE SPINS",12,UDim2.fromOffset(31,61),UDim2.fromOffset(540,24),Color3.fromRGB(119,211,255)) subtitle.TextXAlignment=Enum.TextXAlignment.Left
local timer=label(wheelRoot,"Timer","Free spin in 10m 00s",20,UDim2.fromOffset(716,28),UDim2.fromOffset(390,35),gold)
local discHolder=make("Frame",wheelRoot,{Name="DiscHolder",Position=UDim2.fromOffset(35,94),Size=UDim2.fromOffset(604,580),BackgroundTransparency=1})
local wheel=Art.Create(discHolder,600)
local pointer=label(wheelRoot,"Pointer","▼",67,UDim2.fromOffset(295,75),UDim2.fromOffset(84,78)) pointer.ZIndex=10
local previewPanel=panel(wheelRoot,"RewardPreview",UDim2.fromOffset(681,98),UDim2.fromOffset(424,570),Color3.fromRGB(10,21,30)) previewPanel.BackgroundTransparency=1 previewPanel.UIStroke.Enabled=false
local previewRarity=label(previewPanel,"Rarity","BALL REWARD",12,UDim2.fromOffset(15,17),UDim2.fromOffset(394,26),Color3.fromRGB(134,211,255))
local preview=make("ViewportFrame",previewPanel,{Name="BallPreview",Position=UDim2.fromOffset(40,43),Size=UDim2.fromOffset(344,232),BackgroundTransparency=1,Ambient=Color3.fromRGB(205,215,240),LightColor=Color3.new(1,1,1)})
local rewardIcon=make("Frame",previewPanel,{Name="RewardIcon",Position=UDim2.fromOffset(40,43),Size=UDim2.fromOffset(344,232),BackgroundTransparency=1,Visible=false})
local world=make("WorldModel",preview,{})
local previewCamera=make("Camera",preview,{CFrame=CFrame.lookAt(Vector3.new(1,.6,6.5),Vector3.zero),FieldOfView=44}) preview.CurrentCamera=previewCamera
local previewName=label(previewPanel,"BallName","STORM TALON",28,UDim2.fromOffset(12,280),UDim2.fromOffset(400,40))
local previewDetails=label(previewPanel,"Details","Spin for coins, timed boosts, and custom 3D balls.",15,UDim2.fromOffset(34,324),UDim2.fromOffset(356,54),Color3.fromRGB(177,203,219)) previewDetails.TextWrapped=true
local notice=label(previewPanel,"Notice","Your next reward is one spin away.",19,UDim2.fromOffset(20,389),UDim2.fromOffset(384,72),gold) notice.TextWrapped=true
local buy1=button(previewPanel,"BuyOne","1 SPIN · SOON",UDim2.fromOffset(20,482),UDim2.fromOffset(183,45),Color3.fromRGB(56,49,75)) buy1.Label.TextSize=14 buy1.Label.TextColor3=Color3.fromRGB(164,158,185)
local buy10=button(previewPanel,"BuyTen","10 SPINS · SOON",UDim2.fromOffset(220,482),UDim2.fromOffset(183,45),Color3.fromRGB(56,49,75)) buy10.Label.TextSize=14 buy10.Label.TextColor3=Color3.fromRGB(164,158,185)
label(previewPanel,"PaidStatus","Paid spins coming soon",11,UDim2.fromOffset(20,535),UDim2.fromOffset(384,21),Color3.fromRGB(156,170,185))
local spinButton=button(wheelRoot,"Spin","SPIN",UDim2.fromOffset(60,692),UDim2.fromOffset(554,47),green)
spinButton.Label.TextSize=24
local odds=button(wheelRoot,"Odds","VIEW ODDS",UDim2.fromOffset(682,692),UDim2.fromOffset(208,47),Color3.fromRGB(20,59,85)) odds.Label.TextSize=17
local closeWheel=button(wheelRoot,"Close","CLOSE",UDim2.fromOffset(902,692),UDim2.fromOffset(204,47),Color3.fromRGB(73,82,90)) closeWheel.Label.TextSize=17
local oddsText=panel(previewPanel,"OddsPanel",UDim2.fromOffset(12,12),UDim2.fromOffset(400,365),Color3.fromRGB(12,25,36)) oddsText.Visible=false oddsText.BackgroundTransparency=0 oddsText.ZIndex=10 oddsText.UIStroke.Color=Color3.fromRGB(93,179,222)
label(oddsText,"Title","REWARD ODDS",22,UDim2.fromOffset(10,8),UDim2.fromOffset(380,40))
for i,entry in ipairs({{"x2 Gems · 25 minutes","15%"},{"x2 Coins · 15 minutes","20%"},{"Storm Talon","8%"},{"500 Coins","20%"},{"250 Coins","35%"},{"Molten Fang","2%"}}) do
 local row=panel(oddsText,"Prize"..i,UDim2.fromOffset(12,53+(i-1)*47),UDim2.fromOffset(376,41),i%2==0 and Color3.fromRGB(20,41,54) or Color3.fromRGB(16,33,46)) row.UIStroke.Enabled=false row.BackgroundTransparency=0
 local name=label(row,"Name",entry[1],15,UDim2.fromOffset(12,0),UDim2.fromOffset(282,41),i==6 and gold or Color3.new(1,1,1)) name.TextXAlignment=Enum.TextXAlignment.Left
 label(row,"Chance",entry[2],17,UDim2.fromOffset(294,0),UDim2.fromOffset(70,41),gold)
end
odds.Activated:Connect(function() oddsText.Visible=not oddsText.Visible odds.Label.Text=oddsText.Visible and "×" or "?" end)
for _,b in ipairs({buy1,buy10}) do b.Activated:Connect(function() notice.Text="Paid spins are coming soon." end) end
local function setPreview(id,title,index)
 world:ClearAllChildren() rewardIcon:ClearAllChildren() rewardIcon.Visible=not id
 if id and RS.HussBallModels:FindFirstChild(id) then local model=RS.HussBallModels[id]:Clone() model:PivotTo(CFrame.identity) model.Parent=world preview.Visible=true else
 preview.Visible=false
 if index==1 then
  local gem=make("Frame",rewardIcon,{Position=UDim2.fromOffset(112,57),Size=UDim2.fromOffset(120,120),Rotation=45,BackgroundColor3=Color3.fromRGB(0,240,145),BorderSizePixel=0}) round(gem,UDim.new(0,8)) stroke(gem,Color3.fromRGB(0,103,89),5)
  make("UIGradient",gem,{Color=ColorSequence.new(Color3.fromRGB(172,255,214),Color3.fromRGB(0,150,105)),Rotation=30})
  label(rewardIcon,"Multiplier","x2",44,UDim2.fromOffset(80,60),UDim2.fromOffset(184,120))
 else
  for i=3,1,-1 do
   local coin=make("Frame",rewardIcon,{Position=UDim2.fromOffset(70+i*29,36+i*18),Size=UDim2.fromOffset(120,120),BackgroundColor3=gold,BorderSizePixel=0}) round(coin,UDim.new(.5,0)) stroke(coin,Color3.fromRGB(151,96,10),6)
   make("UIGradient",coin,{Color=ColorSequence.new(Color3.fromRGB(255,235,126),Color3.fromRGB(233,149,7)),Rotation=35})
   label(coin,"C","C",53,UDim2.new(),UDim2.fromScale(1,1),Color3.fromRGB(255,247,180))
  end
  if index==2 then label(rewardIcon,"Multiplier","x2",38,UDim2.fromOffset(204,132),UDim2.fromOffset(98,66),Color3.new(1,1,1)) end
 end
 end
 previewName.Text=title or "STORM TALON"
end
setPreview("Storm","STORM TALON")

-- Fixed composition: transparent stage, bold countdown, large wheel and stacked offers.
brand.Visible=false subtitle.Visible=false
timer.Position=UDim2.fromOffset(72,2) timer.Size=UDim2.fromOffset(650,60) timer.TextSize=40 timer.UIStroke.Thickness=3
discHolder.Position=UDim2.fromOffset(102,75) discHolder.Size=UDim2.fromOffset(600,600)
pointer.Position=UDim2.fromOffset(358,48) pointer.Size=UDim2.fromOffset(88,90) pointer.TextSize=76 pointer.UIStroke.Color=Color3.fromRGB(165,180,190) pointer.UIStroke.Thickness=1.5
previewPanel.Position=UDim2.fromOffset(754,104) previewPanel.Size=UDim2.fromOffset(350,548)
previewRarity.Position=UDim2.fromOffset(4,0) previewRarity.Size=UDim2.fromOffset(342,25) previewRarity.TextSize=15
previewName.Position=UDim2.fromOffset(4,27) previewName.Size=UDim2.fromOffset(342,44) previewName.TextSize=28
preview.Position=UDim2.fromOffset(24,78) preview.Size=UDim2.fromOffset(302,193)
rewardIcon.Position=preview.Position rewardIcon.Size=preview.Size
previewDetails.Position=UDim2.fromOffset(5,451) previewDetails.Size=UDim2.fromOffset(340,48) previewDetails.TextSize=15
notice.Position=UDim2.fromOffset(5,501) notice.Size=UDim2.fromOffset(340,44) notice.TextSize=19
for i,b in ipairs({buy1,buy10}) do
 b.Position=UDim2.fromOffset(4,285+(i-1)*78) b.Size=UDim2.fromOffset(342,65)
 b.BackgroundColor3=Color3.fromRGB(181,48,235) b.Label.TextColor3=Color3.new(1,1,1) b.Label.TextSize=25
 b.Label.Text=i==1 and "1 SPIN · COMING SOON" or "10 SPINS · COMING SOON"
 make("UIGradient",b,{Color=ColorSequence.new(Color3.fromRGB(239,132,255),Color3.fromRGB(155,40,232)),Rotation=90})
 local inset=make("Frame",b,{Name="OfferInset",Position=UDim2.fromOffset(5,5),Size=UDim2.new(1,-10,1,-10),BackgroundTransparency=1})
 round(inset,UDim.new(0,6)) stroke(inset,Color3.fromRGB(242,180,255),1.5)
 b.Label.ZIndex=3
end
previewPanel.PaidStatus.Visible=false
spinButton.Position=UDim2.fromOffset(147,693) spinButton.Size=UDim2.fromOffset(490,60) spinButton.Label.TextSize=35
make("UIGradient",spinButton,{Color=ColorSequence.new(Color3.fromRGB(116,255,101),Color3.fromRGB(8,188,47)),Rotation=90})
closeWheel.Position=UDim2.fromOffset(910,693) closeWheel.Size=UDim2.fromOffset(194,60) closeWheel.Label.TextSize=30
odds.Position=UDim2.fromOffset(8,166) odds.Size=UDim2.fromOffset(67,65) odds.Label.Text="?" odds.Label.TextSize=44 odds.BackgroundColor3=Color3.fromRGB(16,110,245)
make("UIGradient",odds,{Color=ColorSequence.new(Color3.fromRGB(96,192,255),Color3.fromRGB(14,69,218)),Rotation=90})
label(wheelRoot,"OddsCaption","Odds",21,UDim2.fromOffset(0,236),UDim2.fromOffset(84,30))
oddsText.Position=UDim2.fromOffset(-42,55)
local function buttonMotion(b)
 local original=b.Size
 b.MouseEnter:Connect(function() Tween:Create(b,TweenInfo.new(.13,Enum.EasingStyle.Quad),{Size=original+UDim2.fromOffset(4,4)}):Play() end)
 b.MouseLeave:Connect(function() Tween:Create(b,TweenInfo.new(.13,Enum.EasingStyle.Quad),{Size=original}):Play() end)
 b.MouseButton1Down:Connect(function() Tween:Create(b,TweenInfo.new(.07),{Size=original-UDim2.fromOffset(3,3)}):Play() end)
 b.MouseButton1Up:Connect(function() Tween:Create(b,TweenInfo.new(.12,Enum.EasingStyle.Back),{Size=original}):Play() end)
end
for _,b in ipairs({spinButton,closeWheel,odds,buy1,buy10}) do buttonMotion(b) end

local spinning=false local animationToken=0
local function open()
 local map=screen:FindFirstChild("MapVotingFrame") if map then map.Visible=false end
 local reference=screen:FindFirstChild("ReferenceScreens") if reference then local c=reference:FindFirstChild("Collection") if c then c.Visible=false end local e=reference:FindFirstChild("EmoteWheel") if e then e:Destroy() end end
 local hud=screen:FindFirstChild("ReferenceHUD") if hud then hud.Visible=false end
 wheelRoot.Visible=true dim.Visible=true results.Visible=false p:SetAttribute("HussHudModalOpen",true)
 wheelRoot.Position=UDim2.new(.5,0,.5,12) Tween:Create(wheelRoot,TweenInfo.new(.2,Enum.EasingStyle.Quart,Enum.EasingDirection.Out),{Position=UDim2.fromScale(.5,.5)}):Play()
end
local function close()
 if spinning then return end wheelRoot.Visible=false dim.Visible=false restoreHUD()
end
closeWheel.Activated:Connect(close)
local function celebrate()
 for i=1,28 do
  local confetti=make("Frame",wheelRoot,{Name="RewardSpark",Position=UDim2.fromOffset(875,437),Size=UDim2.fromOffset(math.random(3,7),math.random(6,11)),BackgroundColor3=i%2==0 and gold or Color3.fromRGB(73,240,190),BorderSizePixel=0,ZIndex=20,Rotation=math.random(0,180)})
  local motion=Tween:Create(confetti,TweenInfo.new(.65+math.random()*.45,Enum.EasingStyle.Quad,Enum.EasingDirection.Out),{Position=UDim2.fromOffset(875+math.random(-180,180),437+math.random(-110,160)),BackgroundTransparency=1,Rotation=math.random(-240,240)})
  motion:Play() motion.Completed:Once(function() confetti:Destroy() end)
 end
end
spinButton.Activated:Connect(function()
 if spinning then return end spinning=true notice.Text="Choosing your reward…" oddsText.Visible=false
 local ok,data=pcall(function() return remotes.PrizeSpin:InvokeServer("Spin") end)
 if not ok or not data.OK then notice.Text=ok and data.Message or "Spin unavailable. Try again." spinning=false return end
 local start=wheel.Rotation%360 local final=(360-(data.Index-1)*60)%360
 local delta=(final-start)%360
 previewRarity.Text="GOOD LUCK!" notice.Text="Spinning…" animationToken+=1
 local tween=Tween:Create(wheel,TweenInfo.new(5.2,Enum.EasingStyle.Quint,Enum.EasingDirection.Out),{Rotation=wheel.Rotation+360*6+delta})
 tween:Play() tween.Completed:Wait() wheel.Rotation=final
 local duplicate=data.Name:find("duplicate",1,true)~=nil
 local id=not duplicate and (data.Index==3 and "Storm" or data.Index==6 and "Molten" or nil) or nil
 setPreview(id,duplicate and "500 COINS" or data.Name,data.Index) previewRarity.Text="REWARD COLLECTED"
 previewDetails.Text=duplicate and "You already own this ball, so you received 500 coins." or id and "Added to your ball collection. Equip it in My Balls." or data.Index==1 and "Your gem rewards are doubled for 25 minutes." or data.Index==2 and "Your coin rewards are doubled for 15 minutes." or "Added to your coin balance."
 notice.Text="YOU WON · "..data.Name spinning=false celebrate()
end)
UIS.InputBegan:Connect(function(input,processed) if not processed and input.KeyCode==Enum.KeyCode.Escape then if results.Visible then results.Visible=false restoreHUD() else close() end end end)
local side=screen:WaitForChild("ReferenceHUD"):WaitForChild("Side")
local oldLaunch=side:FindFirstChild("PrizeWheel") if oldLaunch then oldLaunch:Destroy() end
local worldTimers={}
-- Saved wheel faces render in Studio and in-game; the client only updates its own countdown.
task.spawn(function()
 local fixture=workspace:WaitForChild("Arena"):WaitForChild("PrizeWheelStand")
 local display=fixture:WaitForChild("Display")
 local prompt=display:WaitForChild("OpenWheel") prompt.Triggered:Connect(open)
 for _,o in ipairs(fixture:GetDescendants()) do if o:IsA("TextLabel") and o.Name=="FreeSpin" then table.insert(worldTimers,o) end end
end)
local elapsed=0 local lastSector=0 local previousVisible=false
Run.RenderStepped:Connect(function(dt)
 elapsed+=dt
 local modal=wheelRoot.Visible or results.Visible
 dim.Visible=wheelRoot.Visible
 local master=screen:FindFirstChild("MasterTop") if master then local banner=screen:FindFirstChild("AnnouncementBanner") master.Visible=not modal and not (banner and banner.Visible) end
 local roundLabel=screen:FindFirstChild("DodgerRoundLabel") if roundLabel then roundLabel.Visible=not modal end
 local camera=workspace.CurrentCamera if camera then resultsScale.Scale=math.min(.86,(camera.ViewportSize.X-32)/800,(camera.ViewportSize.Y-32)/550) wheelScale.Scale=math.min(.66,(camera.ViewportSize.X-32)/1140,(camera.ViewportSize.Y-32)/760) end
 local left=math.max(0,(p:GetAttribute("NextFreeSpin") or os.time()+600)-os.time())
 local countdown=string.format("%dm %02ds",math.floor(left/60),left%60)
 timer.Text=left>0 and "Free Spin: "..countdown or "Free Spin Ready!"
 for _,t in ipairs(worldTimers) do if t.Parent then t.Text=left>0 and "Free Spin in "..countdown or "FREE SPIN READY!" end end
 spinButton.Label.Text=spinning and "Spinning…" or left>0 and "Next Spin · "..countdown or "Spin! (1)"
 spinButton.BackgroundColor3=left>0 and Color3.fromRGB(112,128,120) or green
 if spinning then
  local sector=math.floor((wheel.Rotation+30)/60)
  if sector~=lastSector then lastSector=sector pointer.Rotation=-13 Tween:Create(pointer,TweenInfo.new(.12),{Rotation=0}):Play() end
 end
 if preview.Visible then previewCamera.CFrame=CFrame.lookAt(Vector3.new(math.sin(elapsed*.32)*6.3,.8,math.cos(elapsed*.32)*6.3),Vector3.zero) end
 if results.Visible then local remain=math.max(0,math.ceil(endsAt-workspace:GetServerTimeNow())) nextMatch.Text="Next match · "..remain.."s" if remain==0 then results.Visible=false restoreHUD() end end
end)

