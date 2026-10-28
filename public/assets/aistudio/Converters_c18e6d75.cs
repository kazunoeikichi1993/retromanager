using System;
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;

namespace RetroBatManager
{
    public class Converters
    {
        public static readonly IValueConverter BoolToVis = new BooleanToVisibilityConverter();
    }
}