-- R6 keyframe player. Sequences in Clips are the editable source of truth.
local Pack = {}
Pack.Config = {WalkSpeed=14, MoveSpeed=25, SlideSpeed=58, SlideDuration=0.34, SlideCooldown=1.2}
local cache = {}
function Pack.GetClip(name)
 if cache[name] then return cache[name] end
 local sequence = script.Parent.Clips:FindFirstChild(name)
 if not sequence then return nil end
 local frames={}
 for _,key in sequence:GetKeyframes() do
  local poses={}
  for _,p in key:GetDescendants() do
   if p:IsA("Pose") and p.Name~="HumanoidRootPart" then poses[p.Name]=p.CFrame end
  end
  table.insert(frames,{time=key.Time,poses=poses})
 end
 table.sort(frames,function(a,b) return a.time<b.time end)
 local clip={frames=frames,duration=frames[#frames].time,loop=sequence.Loop,linear=sequence:GetAttribute("Continuous")==true}
 cache[name]=clip
 return clip
end
function Pack.Sample(name,time)
 local clip=Pack.GetClip(name)
 if not clip then return {} end
 local frames=clip.frames
 time=clip.loop and (time%clip.duration) or math.clamp(time,0,clip.duration)
 local a,b=frames[1],frames[#frames]
 for i=1,#frames-1 do
  if time>=frames[i].time and time<=frames[i+1].time then a,b=frames[i],frames[i+1] break end
 end
 local weight=b.time>a.time and (time-a.time)/(b.time-a.time) or 0
 -- Dense gait samples interpolate continuously; one-shot actions ease into each pose.
 if not clip.linear then weight=weight*weight*(3-2*weight) end
 local result={}
 for part,pose in a.poses do result[part]=pose:Lerp(b.poses[part] or CFrame.identity,weight) end
 return result
end
return Pack
