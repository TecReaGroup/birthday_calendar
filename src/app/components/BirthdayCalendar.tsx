import { useState, useEffect } from 'react';
import { Plus, Trash2, Cake, Gift, X, Settings, ArrowLeft } from 'lucide-react';
import { format, startOfYear, endOfYear, eachDayOfInterval, differenceInCalendarDays, getMonth, getDate, setMonth, setDate, getDay, startOfWeek, addDays, endOfMonth } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Lunar } from 'lunar-javascript';

interface Birthday {
  id: string;
  name: string;
  date: string; // MM-DD format
  year?: number; // optional year
  calendar?: 'solar' | 'lunar'; // solar (阳历) or lunar (农历)
}

interface UpcomingBirthday extends Birthday {
  daysUntil: number;
  nextDate: Date;
}

export function BirthdayCalendar() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [isLoadingBirthdays, setIsLoadingBirthdays] = useState(true);
  const [syncError, setSyncError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newMonth, setNewMonth] = useState('');
  const [newDay, setNewDay] = useState('');
  const [newCalendar, setNewCalendar] = useState<'solar' | 'lunar'>('solar');
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [yearOffset, setYearOffset] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  const normalizeBirthday = (birthday: Birthday): Birthday => ({
    ...birthday,
    year: birthday.year ?? undefined,
    calendar: birthday.calendar ?? 'solar',
  });

  const requestJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) {
      let message = '云端数据同步失败';
      try {
        const body = await response.json();
        message = body.error || message;
      } catch {
        message = response.statusText || message;
      }
      throw new Error(message);
    }

    return response.json();
  };

  const getLocalBirthdays = (): Birthday[] => {
    const stored = localStorage.getItem('birthdays');
    if (!stored) return [];

    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.map(normalizeBirthday) : [];
    } catch {
      return [];
    }
  };

  // Load birthdays from D1. If D1 is empty, migrate existing localStorage data once.
  useEffect(() => {
    let ignore = false;

    const loadBirthdays = async () => {
      try {
        const remoteBirthdays = await requestJson<Birthday[]>('/api/birthdays');
        if (ignore) return;

        const localBirthdays = getLocalBirthdays();

        if (remoteBirthdays.length === 0 && localBirthdays.length > 0) {
          const migrated = await Promise.all(
            localBirthdays.map((birthday) =>
              requestJson<Birthday>('/api/birthdays', {
                method: 'POST',
                body: JSON.stringify(normalizeBirthday(birthday)),
              })
            )
          );

          if (!ignore) {
            setBirthdays(migrated.map(normalizeBirthday));
          }
        } else {
          setBirthdays(remoteBirthdays.map(normalizeBirthday));
        }

        setSyncError('');
      } catch (err) {
        if (!ignore) {
          setBirthdays(getLocalBirthdays());
          setSyncError(err instanceof Error ? err.message : '云端数据同步失败');
        }
      } finally {
        if (!ignore) {
          setIsLoadingBirthdays(false);
        }
      }
    };

    loadBirthdays();

    return () => {
      ignore = true;
    };
  }, []);

  // Keep a local backup for offline recovery and first-time migration.
  useEffect(() => {
    if (!isLoadingBirthdays) {
      localStorage.setItem('birthdays', JSON.stringify(birthdays));
    }
  }, [birthdays, isLoadingBirthdays]);

  const yearStart = startOfYear(new Date(currentYear, 0, 1));
  const yearEnd = endOfYear(new Date(currentYear, 11, 31));

  // 将农历日期转换为指定年份的阳历日期
  const lunarToSolar = (lunarMonth: number, lunarDay: number, year: number): Date | null => {
    try {
      const lunar = Lunar.fromYmd(year, lunarMonth, lunarDay);
      const solar = lunar.getSolar();
      return new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
    } catch (e) {
      return null;
    }
  };

  const getBirthdaysForDate = (date: Date) => {
    const monthDay = format(date, 'MM-dd');
    return birthdays.filter(b => {
      if (b.calendar === 'lunar') {
        // 农历生日需要转换
        const [month, day] = b.date.split('-').map(Number);
        const solarDate = lunarToSolar(month, day, date.getFullYear());
        if (solarDate) {
          return format(solarDate, 'MM-dd') === monthDay;
        }
        return false;
      } else {
        // 阳历生日直接比较
        return b.date === monthDay;
      }
    });
  };

  const getBirthdayIntensity = (date: Date) => {
    const dayBirthdays = getBirthdaysForDate(date);
    return dayBirthdays.length;
  };

  // Generate month data
  const generateMonthsData = () => {
    const months = [];
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const monthStart = new Date(currentYear, monthIndex, 1);
      const monthEnd = endOfMonth(monthStart);
      const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

      // Get the starting day of week (0 = Sunday)
      const startDay = getDay(monthStart);

      // Create calendar grid (6 rows x 7 cols max)
      const grid: (Date | null)[][] = [];
      let currentWeek: (Date | null)[] = [];

      // Fill empty days before month starts
      for (let i = 0; i < startDay; i++) {
        currentWeek.push(null);
      }

      // Fill in the days
      monthDays.forEach((day) => {
        currentWeek.push(day);
        if (currentWeek.length === 7) {
          grid.push(currentWeek);
          currentWeek = [];
        }
      });

      // Fill remaining days in last week
      if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
          currentWeek.push(null);
        }
        grid.push(currentWeek);
      }

      months.push({
        monthIndex,
        name: format(monthStart, 'M月', { locale: zhCN }),
        grid
      });
    }
    return months;
  };

  const monthsData = generateMonthsData();

  const getUpcomingBirthdays = (): UpcomingBirthday[] => {
    const today = new Date();
    const todayMonth = getMonth(today);
    const todayDate = getDate(today);
    const threeMonthsLater = new Date(today);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

    return birthdays
      .map(birthday => {
        const [month, day] = birthday.date.split('-').map(Number);
        let nextDate: Date;

        if (birthday.calendar === 'lunar') {
          // 农历生日，转换为今年的阳历日期
          const solarThisYear = lunarToSolar(month, day, today.getFullYear());
          if (solarThisYear && solarThisYear >= today) {
            nextDate = solarThisYear;
          } else {
            // 今年的已经过了，计算明年的
            const solarNextYear = lunarToSolar(month, day, today.getFullYear() + 1);
            nextDate = solarNextYear || new Date(today.getFullYear() + 1, month - 1, day);
          }
        } else {
          // 阳历生日
          nextDate = setDate(setMonth(new Date(), month - 1), day);
          if (getMonth(nextDate) < todayMonth ||
              (getMonth(nextDate) === todayMonth && getDate(nextDate) < todayDate)) {
            nextDate = setDate(setMonth(new Date(today.getFullYear() + 1, month - 1, 1), month - 1), day);
          }
        }

        const daysUntil = differenceInCalendarDays(nextDate, today);

        return {
          ...birthday,
          daysUntil,
          nextDate
        };
      })
      .filter(birthday => birthday.nextDate <= threeMonthsLater)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  };

  const addBirthday = async () => {
    if (!newName.trim() || !newMonth || !newDay) return;

    const birthday = {
      name: newName.trim(),
      date: `${newMonth.padStart(2, '0')}-${newDay.padStart(2, '0')}`,
      year: newYear ? parseInt(newYear) : undefined,
      calendar: newCalendar,
    };

    try {
      const savedBirthday = await requestJson<Birthday>('/api/birthdays', {
        method: 'POST',
        body: JSON.stringify(birthday),
      });

      setBirthdays([...birthdays, normalizeBirthday(savedBirthday)]);
      setNewName('');
      setNewYear('');
      setNewMonth('');
      setNewDay('');
      setNewCalendar('solar');
      setShowAddForm(false);
      setSyncError('');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : '生日保存失败');
    }
  };

  const deleteBirthday = async (id: string) => {
    try {
      await requestJson<{ ok: boolean }>(`/api/birthdays/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      setBirthdays(birthdays.filter(b => b.id !== id));
      setSyncError('');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : '生日删除失败');
    }
  };

  const clearBirthdays = async () => {
    try {
      await Promise.all(
        birthdays.map((birthday) =>
          requestJson<{ ok: boolean }>(`/api/birthdays/${encodeURIComponent(birthday.id)}`, {
            method: 'DELETE',
          })
        )
      );
      setBirthdays([]);
      setSyncError('');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : '数据清空失败');
    }
  };

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const upcomingBirthdays = getUpcomingBirthdays();

  const totalBirthdays = birthdays.filter(b => {
    const [month, day] = b.date.split('-').map(Number);
    const birthdayDate = new Date(currentYear, month - 1, day);
    return birthdayDate >= yearStart && birthdayDate <= yearEnd;
  }).length;

  const thisYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 20 }, (_, i) => thisYear - 10 + i);

  // Group months into rows of 4
  const monthRows = [];
  for (let i = 0; i < monthsData.length; i += 4) {
    monthRows.push(monthsData.slice(i, i + 4));
  }

  // Get visible years (current + 1 above and 1 below), sorted with larger year on right
  const currentYearIndex = availableYears.indexOf(currentYear);
  const visibleYears = [
    currentYearIndex - 1 >= 0 ? availableYears[currentYearIndex - 1] : null,
    currentYear,
    currentYearIndex + 1 < availableYears.length ? availableYears[currentYearIndex + 1] : null,
  ].filter(y => y !== null) as number[];

  const handleYearClick = (year: number) => {
    setCurrentYear(year);
  };

  return (
    <div className="min-h-screen p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">{/* Removed standalone header */}

        {/* Add Birthday Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-purple-200 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">添加生日</h2>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">朋友名字</label>
                  <input
                    type="text"
                    placeholder="输入名字"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">生日日期</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="年（可选）"
                      value={newYear}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (val.length <= 4) {
                          setNewYear(val);
                        }
                      }}
                      className="px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
                      maxLength={4}
                    />
                    <input
                      type="text"
                      placeholder="月"
                      value={newMonth}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (val.length <= 2) {
                          setNewMonth(val);
                        }
                      }}
                      className="px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
                      maxLength={2}
                    />
                    <input
                      type="text"
                      placeholder="日"
                      value={newDay}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (val.length <= 2) {
                          setNewDay(val);
                        }
                      }}
                      className="px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
                      maxLength={2}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">日历类型</label>
                  <div className="relative inline-flex items-center bg-purple-50 rounded-full p-1 w-full">
                    <button
                      type="button"
                      onClick={() => setNewCalendar('solar')}
                      className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                        newCalendar === 'solar'
                          ? 'bg-white text-purple-400 shadow-sm'
                          : 'text-gray-500'
                      }`}
                    >
                      阳历
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCalendar('lunar')}
                      className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                        newCalendar === 'lunar'
                          ? 'bg-white text-purple-400 shadow-sm'
                          : 'text-gray-500'
                      }`}
                    >
                      农历
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={addBirthday}
                  className="flex-1 bg-gradient-to-r from-pink-400 to-purple-400 hover:from-pink-500 hover:to-purple-500 text-white px-4 py-2 rounded-lg transition-all duration-200"
                >
                  确定
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-all duration-200"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {(isLoadingBirthdays || syncError) && (
          <div className="mb-4 rounded-lg border border-purple-200 bg-white/70 px-4 py-3 text-sm text-gray-700">
            {isLoadingBirthdays ? '正在加载云端生日数据...' : syncError}
          </div>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Left: Main Calendar Area or Settings */}
          <div className="min-w-0 flex-1">
            {showSettings ? (
              /* Settings Page */
              <>
                {/* Settings Header */}
                <div className="flex items-center gap-3 mb-6">
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-2 hover:bg-purple-100 rounded-lg transition-all"
                  >
                    <ArrowLeft size={24} className="text-gray-600" />
                  </button>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
                    设置
                  </h1>
                </div>

                {/* Settings Content */}
                <div className="space-y-6">
                  <div className="border border-purple-200 rounded-lg p-6 bg-white/50">
                    <h2 className="text-lg font-semibold text-gray-800">生日日历</h2>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      集中管理阳历和农历生日，按年份查看分布，并自动提醒近期生日。
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
                      <span className="rounded bg-purple-50 px-2 py-1">阳历 / 农历</span>
                      <span className="rounded bg-purple-50 px-2 py-1">近期提醒</span>
                      <span className="rounded bg-purple-50 px-2 py-1">云端同步</span>
                    </div>
                  </div>

                  <div className="border border-purple-200 rounded-lg p-6 bg-white/50">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">数据管理</h2>
                    <button
                      onClick={() => {
                        if (confirm('确定要清空所有生日数据吗？此操作无法撤销。')) {
                          clearBirthdays();
                        }
                      }}
                      className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all text-sm"
                    >
                      清空所有数据
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Calendar View */
              <>
                {/* Title and Year Selector Row */}
                <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
                  <h1 className="flex items-center gap-3 text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
                    <Cake size={36} className="text-pink-500" />
                    生日
                  </h1>
              <div className="flex items-center gap-1">
                {visibleYears.map((year, index) => {
                  const isCenter = year === currentYear;
                  const opacity = isCenter ? 1 : 0.4;

                  return (
                    <button
                      key={year}
                      onClick={() => handleYearClick(year)}
                      className={`px-3 py-1.5 rounded-lg transition-all duration-300 text-sm ${
                        isCenter
                          ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white font-semibold shadow-md'
                          : 'text-gray-600 hover:bg-purple-100'
                      }`}
                      style={{ opacity }}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Calendar Container */}
            <div className="space-y-3">
              {monthRows.map((row, rowIndex) => (
                <div key={rowIndex} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {row.map((month) => (
                    <div key={month.monthIndex} className="border border-purple-200 rounded-lg p-2 bg-white/50">
                      {/* Month Header */}
                      <div className="text-center font-semibold text-gray-700 mb-1.5 text-sm">
                        {month.name}
                      </div>

                      {/* Week Day Headers */}
                      <div className="grid grid-cols-7 gap-0.5 mb-1">
                        {weekDays.map((day, idx) => (
                          <div key={idx} className="text-center text-[10px] text-gray-500 font-medium">
                            {day}
                          </div>
                        ))}
                      </div>

                      {/* Calendar Grid */}
                      <div className="space-y-0.5">
                        {month.grid.map((week, weekIndex) => (
                          <div key={weekIndex} className="grid grid-cols-7 gap-0.5">
                            {week.map((day, dayIndex) => {
                              if (!day) {
                                return <div key={dayIndex} className="aspect-square" />;
                              }

                              const intensity = getBirthdayIntensity(day);
                              const dayBirthdays = getBirthdaysForDate(day);
                              const dateKey = format(day, 'yyyy-MM-dd');
                              const isHovered = hoveredDay === dateKey;
                              const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

                              let bgColor = 'bg-purple-50';
                              let textColor = 'text-gray-700';

                              if (intensity === 1) {
                                bgColor = 'bg-pink-200';
                                textColor = 'text-gray-800';
                              } else if (intensity === 2) {
                                bgColor = 'bg-pink-300';
                                textColor = 'text-gray-900';
                              } else if (intensity >= 3) {
                                bgColor = 'bg-pink-400';
                                textColor = 'text-white';
                              }

                              return (
                                <div
                                  key={dayIndex}
                                  className="relative"
                                  onMouseEnter={() => setHoveredDay(dateKey)}
                                  onMouseLeave={() => setHoveredDay(null)}
                                >
                                  <div
                                    className={`aspect-square ${bgColor} rounded flex items-center justify-center text-[10px] ${textColor} cursor-pointer transition-all duration-150 hover:ring-1 hover:ring-purple-400 hover:scale-105 ${
                                      isToday ? 'ring-1 ring-blue-300 font-bold' : ''
                                    }`}
                                  >
                                    {format(day, 'd')}
                                  </div>

                                  {isHovered && (
                                    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white text-gray-800 text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-xl border border-purple-200">
                                      <div className="font-semibold mb-1">{format(day, 'yyyy年M月d日')}</div>
                                      {dayBirthdays.length > 0 ? (
                                        dayBirthdays.map(b => (
                                          <div key={b.id} className="flex items-center gap-1 text-pink-500">
                                            <Cake size={10} />
                                            {b.name}
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-gray-400">没有生日</div>
                                      )}
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Legend and Stats */}
            <div className="mt-4 flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-gray-600">
                <span>生日密度：</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="flex items-center gap-0.5">
                    <div className="w-4 h-4 bg-purple-50 rounded border border-purple-200" />
                    <span>无</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <div className="w-4 h-4 bg-pink-200 rounded" />
                    <span>1人</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <div className="w-4 h-4 bg-pink-300 rounded" />
                    <span>2人</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <div className="w-4 h-4 bg-pink-400 rounded" />
                    <span>3人+</span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="text-gray-600">
                {totalBirthdays} 个生日在 {currentYear} 年
              </div>
            </div>
              </>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="flex w-full flex-col lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-64">
            <div className="space-y-4 flex-1 overflow-y-auto pb-4">
              {/* Add Birthday Button */}
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-400 to-purple-400 hover:from-pink-500 hover:to-purple-500 text-white px-4 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <Plus size={18} />
                添加生日
              </button>

              {/* Upcoming Birthdays */}
              <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2 font-medium">
                <Gift size={16} />
                即将到来的生日
              </div>
              <div className="space-y-2">
                {upcomingBirthdays.length > 0 ? (
                  upcomingBirthdays.map((birthday) => {
                    const isToday = birthday.daysUntil === 0;
                    // 显示转换后的阳历日期
                    const displayMonth = getMonth(birthday.nextDate) + 1;
                    const displayDay = getDate(birthday.nextDate);

                    return (
                      <div
                        key={birthday.id}
                        className={`p-2.5 rounded-lg border transition-all duration-200 ${
                          isToday
                            ? 'bg-gradient-to-r from-pink-100 to-purple-100 border-pink-300 shadow-md'
                            : 'bg-white/70 border-purple-200 hover:border-purple-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-800 truncate">{birthday.name}</div>
                            <div className="text-xs text-gray-600 mt-0.5">
                              {displayMonth}月{displayDay}日
                              {birthday.year && ` · ${new Date().getFullYear() - birthday.year}岁`}
                            </div>
                          </div>
                          <div className={`ml-2 ${isToday ? 'animate-pulse' : ''}`}>
                            {isToday ? (
                              <div className="bg-gradient-to-r from-pink-500 to-purple-500 text-white px-2 py-1 rounded text-xs font-semibold">
                                今天
                              </div>
                            ) : (
                              <div className="text-right">
                                <div className="text-lg font-bold text-pink-500">
                                  {birthday.daysUntil}
                                </div>
                                <div className="text-xs text-gray-500">天</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-gray-400 py-4 text-sm">
                    还没有添加生日
                  </div>
                )}
              </div>
            </div>

            {/* All Birthdays */}
            {birthdays.length > 0 && (
              <div>
                <div className="text-sm text-gray-600 mb-2 font-medium">所有生日</div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {[...birthdays]
                    .sort((a, b) => {
                      const [monthA, dayA] = a.date.split('-').map(Number);
                      const [monthB, dayB] = b.date.split('-').map(Number);
                      const today = new Date();
                      const todayMonth = getMonth(today) + 1;
                      const todayDay = getDate(today);

                      // 计算距离今天的相对天数（考虑跨年）
                      const getDaysFromToday = (month: number, day: number) => {
                        if (month > todayMonth || (month === todayMonth && day >= todayDay)) {
                          return (month - todayMonth) * 31 + (day - todayDay);
                        } else {
                          return (12 - todayMonth + month) * 31 + (day - todayDay);
                        }
                      };

                      return getDaysFromToday(monthA, dayA) - getDaysFromToday(monthB, dayB);
                    })
                    .map(birthday => {
                      const [month, day] = birthday.date.split('-').map(Number);
                      return (
                        <div
                          key={birthday.id}
                          className="flex items-center justify-between bg-white/70 border border-purple-100 p-2 rounded-lg hover:bg-purple-50 hover:border-purple-200 transition-all group"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-800 truncate">{birthday.name}</div>
                            <div className="text-xs text-gray-500">
                              {month}月{day}日{birthday.calendar === 'lunar' && ' · 农历'}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteBirthday(birthday.id)}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 p-1 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
            </div>

            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(true)}
              className="mt-auto w-full flex-shrink-0 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2.5 rounded-lg transition-all duration-200 shadow-sm"
            >
              <Settings size={18} />
              设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
