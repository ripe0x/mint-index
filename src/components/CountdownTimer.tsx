import { useState, useMemo, useEffect } from "react";

type Props = {
  closeAt: number;
};

export const CountdownTimer = ({ closeAt }: Props) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isExpired, setIsExpired] = useState(false);

  // Convert closeAt to a Date object and format it
  const closeDate = useMemo(() => {
    const date = new Date(closeAt * 1000);
    return {
      full: date.toLocaleString(),
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
    };
  }, [closeAt]);

  useEffect(() => {
    function calculateTimeLeft() {
      const now = Math.floor(Date.now() / 1000);
      const difference = closeAt - now;

      if (difference <= 0) {
        setIsExpired(true);
        return {
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
        };
      }

      return {
        days: Math.floor(difference / 86400),
        hours: Math.floor((difference % 86400) / 3600),
        minutes: Math.floor((difference % 3600) / 60),
        seconds: difference % 60,
      };
    }

    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    // Update every second
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);
    }, 1000);

    // Cleanup
    return () => clearInterval(timer);
  }, [closeAt]);

  // Pad single digits with leading zero
  const pad = (num: number) => String(num).padStart(2, "0");

  if (isExpired) {
    return (
      <div className="text-center space-y-1">
        <div className="text-red-500 font-medium">Mint Closed</div>
        <div className="text-sm text-gray-500">Closed on {closeDate.full}</div>
      </div>
    );
  }

  const timeString = `${
    timeLeft.days > 0 ? `${timeLeft.days} days, ` : ""
  }${pad(timeLeft.hours)}h: ${pad(timeLeft.minutes)}m: ${pad(
    timeLeft.seconds
  )}s`;

  return (
    <div>
      <p className="font-medium">Mint Closes In {timeString}</p>
      {/* <div className="flex justify-center gap-2 text-lg">
        {timeLeft.days > 0 && (
          <div className="flex flex-col items-center">
            <span className="font-mono font-bold">{timeLeft.days}</span>
            <span className="text-xs text-gray-500">days</span>
          </div>
        )}
        <div className="flex flex-col items-center">
          <span className="font-mono font-bold">{pad(timeLeft.hours)}</span>
          <span className="text-xs text-gray-500">hrs</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-mono font-bold">{pad(timeLeft.minutes)}</span>
          <span className="text-xs text-gray-500">min</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-mono font-bold">{pad(timeLeft.seconds)}</span>
          <span className="text-xs text-gray-500">sec</span>
        </div>
      </div> */}
      <p className="text-sm text-gray-500">
        {closeDate.time} on {closeDate.date}
      </p>
    </div>
  );
};
