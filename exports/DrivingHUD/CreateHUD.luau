local StarterGui=game:GetService('StarterGui')
local function make(class,name,parent,p)
 local o=Instance.new(class);o.Name=name
 for k,v in p or {} do o[k]=v end;o.Parent=parent;return o
end
local white=Color3.new(1,1,1)
local function frame(name,parent,x,y,w,h)
 return make('Frame',name,parent,{BackgroundTransparency=1,Position=UDim2.fromOffset(x,y),Size=UDim2.fromOffset(w,h),BorderSizePixel=0})
end
local function art(name,parent,id,x,y,w,h,z,class)
 return make(class or 'ImageLabel',name,parent,{BackgroundTransparency=1,Position=UDim2.fromOffset(x,y),Size=UDim2.fromOffset(w,h),Image='rbxassetid://'..id,ScaleType=Enum.ScaleType.Stretch,ZIndex=z or 2})
end
local function label(name,parent,value,x,y,w,h,size,color,strokeTop,strokeBottom,thickness)
 local o=make('TextLabel',name,parent,{BackgroundTransparency=1,Position=UDim2.fromOffset(x,y),Size=UDim2.fromOffset(w,h),Text=value,TextColor3=color or white,TextSize=size,FontFace=Font.new('rbxasset://fonts/families/Montserrat.json',Enum.FontWeight.Heavy),ZIndex=12})
 local s=make('UIStroke','GradientStroke',o,{Thickness=thickness or 2,Color=white,ApplyStrokeMode=Enum.ApplyStrokeMode.Contextual})
 make('UIGradient','StrokeGradient',s,{Rotation=90,Color=ColorSequence.new(strokeTop or Color3.fromRGB(18,25,14),strokeBottom or Color3.new(0,0,0))})
 return o
end
local gui=assert(StarterGui:FindFirstChild('DrivingState'),'DrivingState missing')
gui.ResetOnSpawn=false;gui.IgnoreGuiInset=true;gui.DisplayOrder=10;gui.ZIndexBehavior=Enum.ZIndexBehavior.Sibling
gui:SetAttribute('DesignViewport',Vector2.new(1124,614))
local old=gui:FindFirstChild('HUD');if old then old:Destroy() end
local root=frame('HUD',gui,0,0,1124,614)
root.AnchorPoint=Vector2.new(.5,.5);root.Position=UDim2.fromScale(.5,.5)
make('UIScale','ViewportScale',root,{Scale=1})
local meter=assert(gui:FindFirstChild('Meter'));meter.Parent=root
meter.AnchorPoint=Vector2.zero;meter.Position=UDim2.fromOffset(478,492);meter.Size=UDim2.fromOffset(173,94)
local needle=assert(meter:FindFirstChild('GaugeNeedle'))
local pivot=frame('NeedlePivot',meter,173*645.5/1320,94*537.5/714,0,0);pivot.Rotation=-100;pivot.ZIndex=4
needle.Parent=pivot;needle.Position=UDim2.fromOffset(-173*53/1320,-94*229/714);needle.Size=UDim2.fromOffset(173*106/1320,94*284/714);needle.ZIndex=5
label('Speed',root,'0 studs/s',464,463,201,31,22)
local boost=assert(gui:FindFirstChild('Group23'));boost.Parent=root
boost.AnchorPoint=Vector2.zero;boost.Position=UDim2.fromOffset(28,166);boost.Size=UDim2.fromOffset(42,264)
local clip=frame('FillClip',boost,42*55/528,264*340/3315,42*460/528,264*3005/3315)
clip.AnchorPoint=Vector2.new(0,1);clip.Position=UDim2.fromOffset(42*55/528,264*(340+3005)/3315);clip.ClipsDescendants=true;clip.ZIndex=4
local fill=assert(boost:FindFirstChild('fill'));fill.Parent=clip;fill.AnchorPoint=Vector2.new(0,1);fill.Position=UDim2.fromScale(0,1);fill.Size=UDim2.fromOffset(42*460/528,264*3005/3315)
local pct=label('Percent',boost,'100%',-26,121,94,25,16,white,Color3.fromRGB(20,19,102),Color3.fromRGB(3,7,41),2);pct.Rotation=-90
local shifty=assert(gui:FindFirstChild('Shifty'));shifty.Parent=root
shifty.AnchorPoint=Vector2.zero;shifty.Position=UDim2.fromOffset(1001,326);shifty.Size=UDim2.fromOffset(84,98);shifty.AutoButtonColor=false
shifty:SetAttribute('NoGlobalHover',true)
make('UIScale','PressScale',shifty,{Scale=1})
local ret=art('Return',root,'102298272841183',470,34,187,54,4,'ImageButton');ret.AutoButtonColor=false
label('Caption',ret,'RETURN',0,0,187,54,26,white,Color3.fromRGB(48,92,23),Color3.fromRGB(12,39,9),2.5)
label('Key',ret,'F',176,-3,18,21,22)
label('Distance',root,'Distance: 0',410,92,308,34,28,white,Color3.fromRGB(48,92,23),Color3.fromRGB(12,39,9),2.5)
local earnings=frame('Earnings',root,535,124,68,25)
art('MoneyIcon',earnings,'89116335365709',0,0,30,24)
label('Value',earnings,'0',31,0,55,25,25,Color3.fromRGB(181,255,26),Color3.fromRGB(53,93,12),Color3.new(0,0,0),2)
local function indicator(name,colorId,backId,x,y,size,rotation)
 local f=frame(name,root,x,y,size,size);f.Rotation=rotation or 0
 -- One full-color silhouette; remaining value is shown by the native percent text.
 local c=frame('FillClip',f,0,size,size,size);c.AnchorPoint=Vector2.new(0,1);c.ClipsDescendants=true;c.ZIndex=3
 local i=art('fill',c,colorId,0,size,size,size,4);i.AnchorPoint=Vector2.new(0,1)
 label('Percent',f,'100%',0,size*.39,size,27,name=='Fuel' and 22 or 18,white,Color3.fromRGB(25,25,25),Color3.new(0,0,0),2)
 return f
end
indicator('Fuel','82754985979904','79326384824426',380,496,91,8)
indicator('VehicleHealth','84629878568932','111654249576666',657,490,94,0)
gui.Enabled=false
return 'Native HUD created in DrivingState; bottom-left currency in separate CurrencyHUD'
