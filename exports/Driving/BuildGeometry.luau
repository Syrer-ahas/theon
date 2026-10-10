local Geometry={Grid=1,MaxHeight=60,MaxParts=500}
function Geometry.Surface(plot)
 if not plot then return end
 for _,p in plot:GetDescendants() do
  local name=string.lower(p.Name):gsub('[%s_]','')
  if p:IsA('BasePart') and (p:GetAttribute('BuildSurface')==true or name=='buildon' or name=='spawnon') then return p end
 end
end
function Geometry.Catalog()
 local map={}
 for _,folder in game.ReplicatedStorage.RollPartTemplates:GetChildren() do
  for _,m in folder:GetChildren() do local id=m:GetAttribute('RollItemId');if id then map[id]=m end end
 end
 return map
end
function Geometry.Clone(template)
 local clone=template:Clone()
 local model
 if clone:IsA('Model') then model=clone else model=Instance.new('Model');clone.Parent=model end
 for _,d in model:GetDescendants() do
  if d:IsA('LuaSourceContainer') or d:IsA('ProximityPrompt') or d:IsA('LayerCollector') or d:IsA('Highlight')
   or d:IsA('ParticleEmitter') or d:IsA('Trail') or d:IsA('Beam') or d:IsA('Sound') then d:Destroy()
  elseif d:IsA('BasePart') then d.Anchored=true;d.CanCollide=true;d.CanTouch=false end
 end
 model.PrimaryPart=nil
 model.WorldPivot=CFrame.identity
 local box,size=model:GetBoundingBox()
 -- Keep the template's authored orientation; its pivot can be tilted or upside down.
 model:PivotTo(CFrame.new(Vector3.new(0,size.Y/2,0)-box.Position))
 model.WorldPivot=CFrame.identity
 local isSlab=template:GetAttribute('IsSlab')==true or template.Name:lower():find('slab',1,true)~=nil
 -- Measured from the model's collision surface, not a single component's box.
 local contactInset=template:GetAttribute('BuildContactInset') or 0
 return model,size,isSlab and 1 or 0,contactInset
end
function Geometry.Rotation(turn,tilt)
 return CFrame.Angles(0,turn*math.pi/2,0)*CFrame.Angles((tilt or 0)*math.pi/2,0,0)
end
function Geometry.Extents(size,turn,tilt)
 local r=Geometry.Rotation(turn,tilt)
 local a,b,c=r.RightVector,r.UpVector,r.LookVector
 return Vector3.new(math.abs(a.X)*size.X+math.abs(b.X)*size.Y+math.abs(c.X)*size.Z,
  math.abs(a.Y)*size.X+math.abs(b.Y)*size.Y+math.abs(c.Y)*size.Z,
  math.abs(a.Z)*size.X+math.abs(b.Z)*size.Y+math.abs(c.Z)*size.Z)
end
function Geometry.Pose(surface,x,y,z,turn,tilt,size,lift,contactInset)
 y+=(lift or 0)
 if (tilt or 0)==0 then y-=(contactInset or 0) end
 local rotation=Geometry.Rotation(turn,tilt)
 if not size then return surface.CFrame*CFrame.new(x,surface.Size.Y/2+y,z)*rotation end
 local extent=Geometry.Extents(size,turn,tilt)
 return surface.CFrame*CFrame.new(x,surface.Size.Y/2+y+extent.Y/2,z)*rotation*CFrame.new(0,-size.Y/2,0)
end
function Geometry.Fits(surface,size,x,y,z,turn,tilt,lift,contactInset)
 local extent=Geometry.Extents(size,turn,tilt)
 return math.abs(x)+extent.X/2<=surface.Size.X/2+.001 and math.abs(z)+extent.Z/2<=surface.Size.Z/2+.001
  and y>=0 and y+(lift or 0)+extent.Y-((tilt or 0)==0 and (contactInset or 0) or 0)<=Geometry.MaxHeight
end
function Geometry.PlacementBox(surface,x,y,z,turn,tilt,size,lift,contactInset)
 local pose=Geometry.Pose(surface,x,y,z,turn,tilt,size,lift,contactInset)
 local box=pose*CFrame.new(0,size.Y/2,0)
 local inset=(tilt or 0)==0 and (contactInset or 0) or 0
 return box+surface.CFrame.UpVector*(inset/2),Vector3.new(size.X,math.max(.01,size.Y-inset),size.Z)
end

-- Side mounts use the actual bracket face, never the whole model's center.
function Geometry.WheelMount(surface,model,size,point,normal)
 if typeof(point)~='Vector3' or typeof(normal)~='Vector3' or normal.Magnitude<.99 or normal.Magnitude>1.01 then return end
 if math.abs(normal.Y)>.05 then return end
 local n=normal.Unit
 local bracket=model:FindFirstChild('block',true)
 if not bracket or not bracket:IsA('BasePart') then return end
 local axis=Vector3.zAxis
 local bracketPose=model:GetPivot():ToObjectSpace(bracket.CFrame)
 local face=bracketPose.Position+axis*(math.abs(bracketPose.RightVector:Dot(axis))*bracket.Size.X+
  math.abs(bracketPose.UpVector:Dot(axis))*bracket.Size.Y+math.abs(bracketPose.LookVector:Dot(axis))*bracket.Size.Z)/2
 local rotation=CFrame.lookAt(Vector3.zero,n)
 local contact=surface.CFrame:PointToWorldSpace(point)
 local pose=CFrame.new(contact)*surface.CFrame.Rotation*rotation*CFrame.new(-face)
 local box=pose*CFrame.new(0,size.Y/2,0)
 local center=surface.CFrame:PointToObjectSpace(box.Position)
 local r=surface.CFrame.Rotation:Inverse()*box.Rotation
 local a,b,c=r.RightVector,r.UpVector,r.LookVector
 local extent=Vector3.new(math.abs(a.X)*size.X+math.abs(b.X)*size.Y+math.abs(c.X)*size.Z,
  math.abs(a.Y)*size.X+math.abs(b.Y)*size.Y+math.abs(c.Y)*size.Z,
  math.abs(a.Z)*size.X+math.abs(b.Z)*size.Y+math.abs(c.Z)*size.Z)
 local fits=math.abs(center.X)+extent.X/2<=surface.Size.X/2+.001 and math.abs(center.Z)+extent.Z/2<=surface.Size.Z/2+.001
  and center.Y-extent.Y/2>=surface.Size.Y/2-.05 and center.Y+extent.Y/2<=surface.Size.Y/2+Geometry.MaxHeight
 return pose,box,size,fits
end
return Geometry


