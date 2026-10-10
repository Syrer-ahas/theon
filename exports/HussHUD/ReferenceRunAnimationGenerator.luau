
local clips=game.ReplicatedStorage.HussR6AnimationPack.Clips
local old=clips.Run old:Destroy()
local run=Instance.new("KeyframeSequence") run.Name="Run" run.Loop=true run:SetAttribute("Continuous",true) run.Parent=clips
local bases={
 Torso=CFrame.Angles(-math.pi/2,0,math.pi),
 Head=CFrame.Angles(-math.pi/2,0,math.pi),
 ["Right Arm"]=CFrame.Angles(0,math.pi/2,0),
 ["Left Arm"]=CFrame.Angles(0,-math.pi/2,0),
 ["Right Leg"]=CFrame.Angles(0,math.pi/2,0),
 ["Left Leg"]=CFrame.Angles(0,-math.pi/2,0)
}
local function pose(parent,name,position,x,y,z)
 local p=Instance.new("Pose") p.Name=name p.Weight=1
 local b=bases[name] or CFrame.identity
 p.CFrame=b:Inverse()*(CFrame.new(position)*CFrame.Angles(math.rad(x),math.rad(y),math.rad(z)))*b p.Parent=parent return p
end
for i=0,40 do
 local t=i/40 local cycle=t*math.pi*2 local swing=math.sin(cycle)
 local k=Instance.new("Keyframe") k.Time=t*.64 k.Parent=run
 local root=Instance.new("Pose") root.Name="HumanoidRootPart" root.Parent=k
 local torso=pose(root,"Torso",Vector3.new(.025*swing,.035*math.cos(cycle*2),0),3,2.4*swing,1.5*swing)
 pose(torso,"Head",Vector3.zero,-3,-1.8*swing,-1.2*swing)
 pose(torso,"Right Arm",Vector3.new(0,0,0),-30*swing-5,0,5)
 pose(torso,"Left Arm",Vector3.new(0,0,0),30*swing-5,0,-5)
 pose(torso,"Right Leg",Vector3.new(0,.08*math.max(0,swing),0),42*swing,0,0)
 pose(torso,"Left Leg",Vector3.new(0,.08*math.max(0,-swing),0),-42*swing,0,0)
end
return {frames=#run:GetKeyframes(),duration=.64}
