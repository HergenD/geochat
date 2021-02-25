class Rectangle
{
    constructor(x,y,w,h)
    {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    contains(p)
    {
        return (p.x < this.x+this.w && p.x > this.x && p.y < this.y+this.h && p.y > this.y);
    }

    overlaps(rect)
    {
        return !(this.x > rect.x+rect.w || this.x+this.w < rect.x || this.y > rect.y+rect.h || this.y+this.h < rect.y);
    }
}

class Point
{
    constructor(x,y)
    {
        this.x = x;
        this.y = y;
    }
}

class QTree
{
    constructor(bounds, maxPoints)
    {
        this.bounds = bounds;
        this.maxPoints = maxPoints;
        this.pointCount = 0;
        this.points = [];
        this.quadrants = [];
    }

    subdivide()
    {
        this.quadrants[0] = new QTree(new Rectangle(this.bounds.x, this.bounds.y, this.bounds.w/2, this.bounds.h/2), this.maxPoints);
        this.quadrants[1] = new QTree(new Rectangle(this.bounds.x+this.bounds.w/2, this.bounds.y, this.bounds.w/2, this.bounds.h/2), this.maxPoints);
        this.quadrants[2] = new QTree(new Rectangle(this.bounds.x, this.bounds.y+this.bounds.h/2, this.bounds.w/2, this.bounds.h/2), this.maxPoints);
        this.quadrants[3] = new QTree(new Rectangle(this.bounds.x+this.bounds.w/2, this.bounds.y+this.bounds.h/2, this.bounds.w/2, this.bounds.h/2), this.maxPoints);
    }

    //inserts a point into this.points, or passes it on to children.
    insert(p)
    {
        if(!this.bounds.contains(p)) return;
        if(this.pointCount >= this.maxPoints)
        {
            if(this.quadrants.length == 0)
            {
                this.subdivide();
            }
            this.quadrants.forEach(qt => {
                qt.insert(p);
            });
        }
        else
        {
            this.points.push(p);
            this.pointCount++;
        }
    }

    //returns an array of the bounding rect of this and bounding rects of any children.
    getAllBounds()
    {
        let allBounds = [];
        allBounds.push(this.bounds);
        this.quadrants.forEach(qt => {
            allBounds = [...allBounds, ...qt.getAllBounds()];
        });
        return allBounds;
    }

    //returns the amount of points in the specified area
    getPointsInRect(rect)
    {
        if(!this.bounds.overlaps(rect))
        {
            return 0;
        }
        let total = 0;
        this.points.forEach(p => {
            if(rect.contains(p))
            {
                total++;
            }
        })
        this.quadrants.forEach(qt => {
            total += qt.getPointsInRect(rect);
        })
        return total;
    }

    //returns a rectangle which contains the most amount of points in the quadtree
    getHighestPopulationRect(width, height, stepsize)
    {
        let max = 0;
        let rect = new Rectangle(0,0,0,0);
        for(let i = 0; i < (this.bounds.w-width)/stepsize; i++)
        {
            for(let j = 0; j < (this.bounds.h-height)/stepsize; j++)
            {
                let r = new Rectangle(i*stepsize, j*stepsize, width, height)
                let n = this.getPointsInRect(r)
                if(n>max)
                {
                    max = n;
                    rect = r;
                }
            }
        }
        return rect;
    }
}