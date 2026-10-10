
local Art={}
local RS=game:GetService("ReplicatedStorage")
local font=Font.new("rbxasset://fonts/families/Montserrat.json",Enum.FontWeight.Heavy)
local blue=Color3.fromRGB(0,132,255)
local gold=Color3.fromRGB(255,199,31)
local prizes={
 {Name="x2 Gems",Detail="25 MINUTES",Color=Color3.fromRGB(0,140,250),Kind="Gem"},
 {Name="x2 Coins",Detail="15 MINUTES",Color=Color3.fromRGB(0,119,235),Kind="Coin"},
 {Name="STORM TALON",Detail="RARE BALL",Color=Color3.fromRGB(235,250,255),Kind="Ball",Id="Storm"},
 {Name="500 Coins",Detail="COIN REWARD",Color=Color3.fromRGB(0,126,245),Kind="Coin"},
 {Name="250 Coins",Detail="COIN REWARD",Color=Color3.fromRGB(0,150,255),Kind="Coin"},
 {Name="MOLTEN FANG",Detail="RARE BALL",Color=Color3.fromRGB(255,215,22),Kind="Ball",Id="Molten"}
}
function Art.Create(parent,size)
 local function make(class,p,props) local o=Instance.new(class) for k,v in pairs(props) do o[k]=v end o.Parent=p return o end
 local function round(o) make("UICorner",o,{CornerRadius=UDim.new(.5,0)}) end
 local function stroke(o,color,width) make("UIStroke",o,{Color=color,Thickness=width}) end
 local function label(p,name,txt,sz,pos,dims,color)
  local o=make("TextLabel",p,{Name=name,BackgroundTransparency=1,Text=txt,TextSize=sz,TextColor3=color,FontFace=font,Position=pos,Size=dims}) stroke(o,Color3.fromRGB(12,25,40),sz*.07) return o
 end
 local d=make("Frame",parent,{Name="Disc",AnchorPoint=Vector2.new(.5,.5),Position=UDim2.fromScale(.5,.5),Size=UDim2.fromOffset(size,size),BackgroundColor3=blue,ClipsDescendants=true})
 round(d) stroke(d,Color3.fromRGB(5,24,49),size*.012)
 local radius=size/2
 for j=0,179 do
  local angle=j*2 local sector=math.floor(angle/60)+1 local a=math.rad(angle-30)
  local strip=make("Frame",d,{AnchorPoint=Vector2.new(.5,.5),Position=UDim2.fromOffset(radius+math.sin(a)*radius*.5,radius-math.cos(a)*radius*.5),Size=UDim2.fromOffset(size*.022,radius*1.02),Rotation=angle-30,BackgroundColor3=prizes[sector].Color,BorderSizePixel=0})
  make("UIGradient",strip,{Color=ColorSequence.new(Color3.new(1,1,1),Color3.fromRGB(165,190,225)),Rotation=90})
 end
 for i=0,5 do local a=math.rad(i*60-30)
  make("Frame",d,{AnchorPoint=Vector2.new(.5,.5),Position=UDim2.fromOffset(radius+math.sin(a)*radius*.5,radius-math.cos(a)*radius*.5),Size=UDim2.fromOffset(size*.006,radius),Rotation=i*60-30,BackgroundColor3=Color3.fromRGB(15,37,61),BorderSizePixel=0})
 end
 for i,entry in ipairs(prizes) do
  local a=math.rad((i-1)*60) local x=radius+math.sin(a)*size*.32 local y=radius-math.cos(a)*size*.32
  local tile=make("Frame",d,{Name="Prize"..i,BackgroundTransparency=1,AnchorPoint=Vector2.new(.5,.5),Position=UDim2.fromOffset(x,y),Size=UDim2.fromOffset(size*.26,size*.29),Rotation=(i-1)*60})
  local dark=i==3 or i==6
  local textColor=dark and Color3.fromRGB(255,255,255) or Color3.new(1,1,1)
  label(tile,"Name",entry.Name,size*.043,UDim2.fromScale(-.04,.56),UDim2.fromScale(1.08,.34),textColor).TextWrapped=true
  label(tile,"Detail",entry.Detail,size*.021,UDim2.fromScale(0,.91),UDim2.fromScale(1,.14),dark and Color3.fromRGB(255,230,99) or Color3.fromRGB(200,235,255))
  if entry.Kind=="Ball" then
   local v=make("ViewportFrame",tile,{Name="Ball",BackgroundTransparency=1,Position=UDim2.fromScale(.23,-.025),Size=UDim2.fromScale(.54,.61),Ambient=Color3.fromRGB(205,215,240),LightColor=Color3.new(1,1,1)})
   local world=make("WorldModel",v,{}) local model=RS.HussBallModels[entry.Id]:Clone() model:PivotTo(CFrame.identity) model.Parent=world
   local camera=make("Camera",v,{CFrame=CFrame.lookAt(Vector3.new(1.3,.7,6),Vector3.zero),FieldOfView=44}) v.CurrentCamera=camera
  elseif entry.Kind=="Gem" then
   local gem=make("Frame",tile,{Position=UDim2.fromScale(.35,.13),Size=UDim2.fromOffset(size*.085,size*.085),BackgroundColor3=Color3.fromRGB(0,243,143),Rotation=45,BorderSizePixel=0})
   make("UICorner",gem,{CornerRadius=UDim.new(0,size*.006)}) stroke(gem,Color3.fromRGB(0,103,96),size*.006)
   make("UIGradient",gem,{Color=ColorSequence.new(Color3.fromRGB(210,255,229),Color3.fromRGB(0,162,105)),Rotation=35})
   local shine=make("Frame",gem,{Position=UDim2.fromScale(.16,.12),Size=UDim2.fromScale(.67,.1),BackgroundColor3=Color3.new(1,1,1),BackgroundTransparency=.2,BorderSizePixel=0})
  else
   for k=3,1,-1 do
    local coin=make("Frame",tile,{Position=UDim2.fromScale(.21+k*.09,.045+k*.055),Size=UDim2.fromOffset(size*.09,size*.09),BackgroundColor3=gold,BorderSizePixel=0})
    round(coin) stroke(coin,Color3.fromRGB(149,99,12),size*.008)
    make("UIGradient",coin,{Color=ColorSequence.new(Color3.fromRGB(255,238,104),Color3.fromRGB(234,149,8)),Rotation=40})
    label(coin,"C","C",size*.045,UDim2.new(),UDim2.fromScale(1,1),Color3.fromRGB(255,239,143))
   end
  end
 end
 local hub=make("Frame",d,{Name="Hub",AnchorPoint=Vector2.new(.5,.5),Position=UDim2.fromScale(.5,.5),Size=UDim2.fromScale(.195,.195),BackgroundColor3=Color3.fromRGB(0,132,255)})
 round(hub) stroke(hub,Color3.fromRGB(173,230,255),size*.006)
 
 local pin=make("Frame",hub,{AnchorPoint=Vector2.new(.5,.5),Position=UDim2.fromScale(.5,.5),Size=UDim2.fromScale(.23,.23),BackgroundColor3=Color3.fromRGB(241,245,249),BorderSizePixel=0}) round(pin) stroke(pin,Color3.fromRGB(15,37,61),size*.004)
 
 local border=make("Frame",d,{Name="Rim",Size=UDim2.fromScale(1,1),BackgroundTransparency=1}) round(border) stroke(border,Color3.fromRGB(148,218,255),size*.006)
 return d
end
return Art
