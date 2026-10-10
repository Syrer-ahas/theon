local Stats = {}
-- Game balance kilograms; separate from Roblox's physical mass units.
Stats.Wheels = {
 ['tires:3']={mass=8,capacity=120,grip=1},
 ['tires:12']={mass=10,capacity=250,grip=1.15},
 ['tires:40']={mass=12,capacity=500,grip=1.3},
}
Stats.Engines = {
 ['Engines:1']={mass=10,power=100,speed=38},
 ['Engines:2']={mass=11,power=145,speed=44},
 ['Engines:3']={mass=12,power=200,speed=52},
 ['Engines:4']={mass=14,power=300,speed=62},
 ['Engines:5']={mass=16,power=420,speed=72},
 ['Engines:6']={mass=19,power=650,speed=90},
 ['Engines:7']={mass=22,power=900,speed=105},
}
local blocks={8,10,22,14,16,8,7,5,11,4}
function Stats.Part(id)
 local wheel=Stats.Wheels[id]
 if wheel then return {mass=wheel.mass,capacity=wheel.capacity,grip=wheel.grip,kind='Wheel'} end
 local engine=Stats.Engines[id]
 if engine then return {mass=engine.mass,power=engine.power,speed=engine.speed,kind='Engine'} end
 local n=tonumber(string.match(id or '', '^blocks:(%d+)$'))
 if n then return {mass=blocks[n] or 10,kind='Body'} end
 if id=='Supports_PilotChair' then return {mass=6,kind='Pilot'} end
 if id=='Supports_PassengerSeat' then return {mass=5,kind='Passenger'} end
 if string.match(id or '', '^Fuel:') then return {mass=id=='Fuel:8' and 6 or 12,kind='Fuel'} end
 return {mass=12,kind='Body'}
end
function Stats.Calculate(ids)
 local result={weight=75,capacity=0,power=0,wheels=0,engines=0,pilots=0,topSpeed=0,grip=0}
 local bestSpeed=0
 for _,entry in ids do
  local id=typeof(entry)=='table' and entry.id or entry
  local eligible=typeof(entry)~='table' or entry.grounded~=false
  local p=Stats.Part(id)
  result.weight+=p.mass
  if p.kind=='Wheel' and eligible then result.wheels+=1;result.capacity+=p.capacity;result.grip+=p.grip end
  if p.kind=='Engine' then result.engines+=1;result.power+=p.power;bestSpeed=math.max(bestSpeed,p.speed) end
  if p.kind=='Pilot' then result.pilots+=1 end
 end
 result.grip=result.grip/math.max(1,result.wheels)
 result.load=result.weight/math.max(1,result.capacity)
 result.acceleration=math.clamp(18*result.power/result.weight,0,65)
 local weightFactor=math.clamp(math.sqrt(result.power/math.max(1,result.weight)),.35,1)
 result.topSpeed=math.min(120,bestSpeed*(1+.14*math.sqrt(math.max(0,result.engines-1))))*weightFactor
 if result.pilots==0 then result.error='Place a Pilot Chair on your car first.'
 elseif result.wheels<2 then result.error='Your car needs at least two connected, upright tires at its base.'
 elseif result.weight>result.capacity then result.error=string.format('Too heavy: %d kg / %d kg. Add or upgrade tires.',result.weight,result.capacity)
 elseif result.engines==0 then result.error='Place an engine on your car first.' end
 return result
end
return Stats
