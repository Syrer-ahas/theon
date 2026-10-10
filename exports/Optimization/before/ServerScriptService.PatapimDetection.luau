local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")
local TAG = "FastWalkingPatapim"
local models = {}
local function set(model, name, value)
 if model:GetAttribute(name) ~= value then model:SetAttribute(name,value) end
end
local function add(model)
 local mesh=model:FindFirstChild(model:GetAttribute("FollowMeshName") or "Mesh")
 if not model:IsA("Model") or not mesh or not mesh:IsA("BasePart") then return end
 local params=RaycastParams.new()
 params.FilterType=Enum.RaycastFilterType.Exclude
 params.FilterDescendantsInstances={model}
 params.RespectCanCollide=true
 local floor=workspace:Raycast(mesh.Position,Vector3.new(0,-30,0),params)
 local box,size=model:GetBoundingBox()
 models[model]={mesh=mesh,params=params,clearance=floor and mesh.Position.Y-floor.Position.Y or nil,target=nil,
  areaFloorOffset=mesh.Position.Y-(box.Position.Y-size.Y/2)+.05,
  areaMargin=math.max(size.X,size.Z)/2+1}
end
for _,model in CollectionService:GetTagged(TAG) do add(model) end
CollectionService:GetInstanceAddedSignal(TAG):Connect(add)
CollectionService:GetInstanceRemovedSignal(TAG):Connect(function(model)
 models[model]=nil
 set(model,"TargetUserId",0)
 set(model,"PatapimState","Idle")
end)
local scanElapsed=0
RunService.Heartbeat:Connect(function(dt)
 scanElapsed+=dt
 if scanElapsed>=.15 then
  scanElapsed=0
  local living={}
  local excluded={}
  for model in models do table.insert(excluded,model) end
  for _,player in Players:GetPlayers() do
   local character=player.Character
   local root=character and character:FindFirstChild("HumanoidRootPart")
   local humanoid=character and character:FindFirstChildOfClass("Humanoid")
   if character then table.insert(excluded,character) end
   if root and humanoid and humanoid.Health>0 then
    table.insert(living,{player=player,root=root})
   end
  end
  for model,rig in models do
   rig.params.FilterDescendantsInstances=excluded
   local nearest
   local radius=math.clamp(model:GetAttribute("DetectionRadius") or 50,0,500)
   local best=radius*radius
   if model:GetAttribute("DetectionEnabled")~=false then
    for _,candidate in living do
     local offset=candidate.root.Position-rig.mesh.Position
     local squared=offset:Dot(offset)
     if squared<=best then nearest=candidate;best=squared end
    end
   end
   rig.target=nearest
   set(model,"TargetUserId",nearest and nearest.player.UserId or 0)
  end
 end
 for model,rig in models do
  if not model:IsDescendantOf(workspace) or not rig.mesh.Parent then models[model]=nil;continue end
  local target=rig.target
  local state="Idle"
  if target and target.root.Parent and model:GetAttribute("DetectionEnabled")~=false then
   local mesh=rig.mesh
   local position=mesh.Position
   local delta=target.root.Position-position
   local horizontal=Vector3.new(delta.X,0,delta.Z)
   local distance=horizontal.Magnitude
   local range=math.clamp(model:GetAttribute("PunchRange") or 2,.5,10)
   state=distance<=range and math.abs(delta.Y)<=6 and "Punch" or "Walk"
   if distance>.001 then
    local direction=horizontal.Unit
    local nextPosition=position
    if state=="Walk" then
     local speed=math.clamp(model:GetAttribute("FollowSpeed") or 16,0,50)
     local step=math.min(speed*math.min(dt,.1),math.max(0,distance-range))
     local obstacle=workspace:Raycast(position,direction*(step+.6),rig.params)
     if not obstacle then
      local proposed=position+direction*step
      if model:GetAttribute("Area1Spawn") then
       local area=workspace:FindFirstChild("area1")
       if area and area:IsA("BasePart") then
        local localPosition=area.CFrame:PointToObjectSpace(proposed)
        local halfX=math.max(0,area.Size.X/2-rig.areaMargin)
        local halfZ=math.max(0,area.Size.Z/2-rig.areaMargin)
        local surface=area.CFrame:PointToWorldSpace(Vector3.new(
         math.clamp(localPosition.X,-halfX,halfX),area.Size.Y/2,
         math.clamp(localPosition.Z,-halfZ,halfZ)))
        proposed=surface+Vector3.new(0,rig.areaFloorOffset,0)
       end
      else
       local ground=workspace:Raycast(proposed+Vector3.new(0,8,0),Vector3.new(0,-40,0),rig.params)
       if ground and rig.clearance then
        proposed=Vector3.new(proposed.X,ground.Position.Y+rig.clearance,proposed.Z)
       end
      end
      nextPosition=proposed
     end
    end
    local desired=CFrame.lookAt(nextPosition,nextPosition+direction)
    local rotation=mesh.CFrame.Rotation:Lerp(desired.Rotation,1-math.exp(-dt*12))
    local nextMesh=CFrame.new(nextPosition)*rotation
    -- Preserve the imported mesh-to-model pivot offset.
    model:PivotTo(nextMesh*mesh.CFrame:ToObjectSpace(model:GetPivot()))
   end
  end
  if state=="Punch" and model:GetAttribute("PatapimState")~="Punch" then
   model:SetAttribute("PunchStartedAt",workspace:GetServerTimeNow())
  end
  set(model,"PatapimState",state)
 end
end)
